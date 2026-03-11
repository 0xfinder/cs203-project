package com.group7.app.lesson.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.group7.app.lesson.model.LessonStep;
import com.group7.app.lesson.model.QuestionType;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class LessonStepPayloadService {

    private static final JsonNodeFactory JSON = JsonNodeFactory.instance;

    private final ObjectMapper objectMapper;

    public LessonStepPayloadService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public JsonNode emptyPayload() {
        return JSON.objectNode();
    }

    public JsonNode buildTeachPayload(String title, String body, String example, String partOfSpeech) {
        ObjectNode payload = JSON.objectNode();
        payload.put("title", title);
        payload.put("body", body);
        if (example != null) {
            payload.put("example", example);
        }
        if (partOfSpeech != null) {
            payload.put("partOfSpeech", partOfSpeech);
        }
        return payload;
    }

    public JsonNode buildDialoguePayload(String dialogueText) {
        ObjectNode payload = JSON.objectNode();
        payload.put("text", dialogueText);
        return payload;
    }

    public JsonNode buildQuestionPayload(
            QuestionType questionType,
            String prompt,
            String explanation,
            List<String> options,
            Integer correctOptionIndex,
            List<String> acceptedAnswers,
            List<MatchPairWrite> matchPairs) {
        ObjectNode payload = JSON.objectNode();
        payload.put("questionType", questionType.name());
        payload.put("prompt", prompt);
        if (explanation != null) {
            payload.put("explanation", explanation);
        }

        if (questionType == QuestionType.MCQ) {
            if (options == null || options.size() < 2 || correctOptionIndex == null) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "mcq requires at least two options and correctOptionIndex");
            }
            if (correctOptionIndex < 0 || correctOptionIndex >= options.size()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "correctOptionIndex out of bounds");
            }

            ArrayNode choices = payload.putArray("choices");
            for (int i = 0; i < options.size(); i++) {
                ObjectNode choice = choices.addObject();
                choice.put("id", i + 1L);
                choice.put("text", options.get(i));
                choice.put("orderIndex", i + 1);
            }
            payload.putObject("answerKey").put("choiceId", correctOptionIndex + 1L);
            return payload;
        }

        if (questionType == QuestionType.CLOZE || questionType == QuestionType.SHORT_ANSWER) {
            if (acceptedAnswers == null || acceptedAnswers.isEmpty()) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "acceptedAnswers is required for cloze/short answer");
            }
            ArrayNode answers = payload.putArray("acceptedAnswers");
            for (String acceptedAnswer : acceptedAnswers) {
                answers.add(acceptedAnswer);
            }
            return payload;
        }

        if (questionType == QuestionType.MATCH) {
            if (matchPairs == null || matchPairs.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "matchPairs is required for match type");
            }
            ArrayNode pairs = payload.putArray("matchPairs");
            for (int i = 0; i < matchPairs.size(); i++) {
                MatchPairWrite pair = matchPairs.get(i);
                ObjectNode node = pairs.addObject();
                node.put("id", i + 1L);
                node.put("left", pair.left());
                node.put("right", pair.right());
                node.put("orderIndex", i + 1);
            }
            return payload;
        }

        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "unsupported question type");
    }

    public JsonNode buildRecapPayload(JsonNode payload) {
        if (payload == null || !payload.isObject()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "payload is required for recap step");
        }
        return payload.deepCopy();
    }

    public String readDialogueText(LessonStep step) {
        JsonNode text = step.getPayload().get("text");
        return text != null && text.isTextual() ? text.asText() : null;
    }

    public QuestionContent readQuestion(LessonStep step) {
        JsonNode payload = step.getPayload();
        QuestionType questionType = QuestionType.valueOf(readRequiredText(payload, "questionType"));
        String prompt = readRequiredText(payload, "prompt");
        String explanation = readOptionalText(payload, "explanation");

        List<ChoiceOption> choices = new ArrayList<>();
        JsonNode choicesNode = payload.get("choices");
        if (choicesNode != null && choicesNode.isArray()) {
            for (int i = 0; i < choicesNode.size(); i++) {
                JsonNode choice = choicesNode.get(i);
                choices.add(new ChoiceOption(
                        choice.path("id").asLong(i + 1L),
                        readRequiredText(choice, "text"),
                        choice.path("orderIndex").asInt(i + 1)));
            }
        }

        List<MatchPairOption> matchPairs = new ArrayList<>();
        JsonNode pairsNode = payload.get("matchPairs");
        if (pairsNode != null && pairsNode.isArray()) {
            for (int i = 0; i < pairsNode.size(); i++) {
                JsonNode pair = pairsNode.get(i);
                matchPairs.add(new MatchPairOption(
                        pair.path("id").asLong(i + 1L),
                        readRequiredText(pair, "left"),
                        readOptionalText(pair, "right"),
                        pair.path("orderIndex").asInt(i + 1)));
            }
        }

        List<String> acceptedAnswers = new ArrayList<>();
        JsonNode acceptedNode = payload.get("acceptedAnswers");
        if (acceptedNode != null && acceptedNode.isArray()) {
            for (JsonNode answer : acceptedNode) {
                if (answer.isTextual()) {
                    acceptedAnswers.add(answer.asText());
                }
            }
        }

        return new QuestionContent(questionType, prompt, explanation, choices, matchPairs, acceptedAnswers);
    }

    public Evaluation evaluate(LessonStep step, JsonNode submitted) {
        QuestionContent question = readQuestion(step);

        if (question.questionType() == QuestionType.MCQ) {
            long correctChoiceId = step.getPayload().path("answerKey").path("choiceId").asLong(-1L);
            ChoiceOption correctChoice = question.choices().stream()
                    .filter(choice -> choice.id() == correctChoiceId)
                    .findFirst()
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "question has no answer key"));
            String submittedText = extractStringAnswer(submitted);
            boolean correct = normalize(submittedText).equals(normalize(correctChoice.text()));
            ObjectNode evaluatedAnswer = JSON.objectNode();
            evaluatedAnswer.put("choiceId", correctChoice.id());
            evaluatedAnswer.put("text", correctChoice.text());
            return new Evaluation(correct, evaluatedAnswer, correctChoice.text(), question.explanation());
        }

        if (question.questionType() == QuestionType.CLOZE || question.questionType() == QuestionType.SHORT_ANSWER) {
            String submittedText = normalize(extractStringAnswer(submitted));
            boolean correct = question.acceptedAnswers().stream().anyMatch(answer -> normalize(answer).equals(submittedText));
            String expected = question.acceptedAnswers().isEmpty() ? "" : question.acceptedAnswers().getFirst();
            ObjectNode evaluatedAnswer = JSON.objectNode();
            ArrayNode answers = evaluatedAnswer.putArray("acceptedAnswers");
            for (String answer : question.acceptedAnswers()) {
                answers.add(answer);
            }
            return new Evaluation(correct, evaluatedAnswer, expected, question.explanation());
        }

        if (question.questionType() == QuestionType.MATCH) {
            Map<String, String> expectedMap = new LinkedHashMap<>();
            for (MatchPairOption pair : question.matchPairs()) {
                if (pair.right() != null) {
                    expectedMap.put(normalize(pair.left()), normalize(pair.right()));
                }
            }
            Map<String, String> submittedMap = parseMatchAnswer(submitted);
            boolean correct = expectedMap.equals(submittedMap);
            ArrayNode pairs = JSON.arrayNode();
            for (MatchPairOption pair : question.matchPairs()) {
                ObjectNode node = pairs.addObject();
                node.put("left", pair.left());
                if (pair.right() != null) {
                    node.put("right", pair.right());
                }
            }
            ObjectNode evaluatedAnswer = JSON.objectNode();
            evaluatedAnswer.set("pairs", pairs);
            String expected = question.matchPairs().stream()
                    .map(pair -> pair.left() + " = " + pair.right())
                    .reduce((left, right) -> left + "; " + right)
                    .orElse("");
            return new Evaluation(correct, evaluatedAnswer, expected, question.explanation());
        }

        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "unsupported question type");
    }

    public List<String> shuffledRights(QuestionContent questionContent) {
        List<String> rights = questionContent.matchPairs().stream()
                .map(MatchPairOption::right)
                .filter(value -> value != null && !value.isBlank())
                .collect(java.util.stream.Collectors.toCollection(ArrayList::new));
        Collections.shuffle(rights);
        return rights;
    }

    public JsonNode sanitizePayloadForPlay(LessonStep step) {
        JsonNode payload = step.getPayload().deepCopy();
        if (step.getStepType() != com.group7.app.lesson.model.StepType.QUESTION) {
            return payload;
        }
        ((ObjectNode) payload).remove("answerKey");
        return payload;
    }

    private static String readRequiredText(JsonNode node, String field) {
        String value = readOptionalText(node, field);
        if (value == null || value.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "step payload missing " + field);
        }
        return value;
    }

    private static String readOptionalText(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value != null && value.isTextual() ? value.asText() : null;
    }

    private static String extractStringAnswer(JsonNode answer) {
        if (answer == null || answer.isNull()) {
            return null;
        }
        if (answer.isTextual()) {
            return answer.asText();
        }
        if (answer.isObject()) {
            JsonNode nestedAnswer = answer.get("answer");
            if (nestedAnswer != null && nestedAnswer.isTextual()) {
                return nestedAnswer.asText();
            }
        }
        return answer.toString();
    }

    private static Map<String, String> parseMatchAnswer(JsonNode raw) {
        if (raw == null || !raw.isObject()) {
            return Map.of();
        }

        Map<String, String> normalized = new LinkedHashMap<>();
        raw.fields().forEachRemaining(entry -> {
            if (entry.getValue().isTextual()) {
                normalized.put(normalize(entry.getKey()), normalize(entry.getValue().asText()));
            }
        });
        return normalized;
    }

    private static String normalize(String value) {
        if (value == null) {
            return "";
        }
        return value.trim().toLowerCase(Locale.ROOT);
    }

    public record MatchPairWrite(String left, String right) {
    }

    public record ChoiceOption(long id, String text, int orderIndex) {
    }

    public record MatchPairOption(long id, String left, String right, int orderIndex) {
    }

    public record QuestionContent(
            QuestionType questionType,
            String prompt,
            String explanation,
            List<ChoiceOption> choices,
            List<MatchPairOption> matchPairs,
            List<String> acceptedAnswers) {
    }

    public record Evaluation(boolean correct, JsonNode evaluatedAnswer, String correctAnswerText, String explanation) {
    }
}
