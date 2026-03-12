-- Add author_id (FK to users) to questions and answers
ALTER TABLE questions ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES users(id);
ALTER TABLE answers ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES users(id);

-- Create indexes for author lookups
CREATE INDEX IF NOT EXISTS idx_questions_author_id ON questions(author_id);
CREATE INDEX IF NOT EXISTS idx_answers_author_id ON answers(author_id);

-- Question votes
CREATE TABLE IF NOT EXISTS question_votes (
    id          BIGSERIAL PRIMARY KEY,
    question_id BIGINT    NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    user_id     UUID      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vote_type   VARCHAR(20) NOT NULL CHECK (vote_type IN ('THUMBS_UP', 'THUMBS_DOWN')),
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_question_vote UNIQUE(question_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_question_votes_question_id ON question_votes(question_id);
CREATE INDEX IF NOT EXISTS idx_question_votes_user_id ON question_votes(user_id);

-- Answer votes
CREATE TABLE IF NOT EXISTS answer_votes (
    id          BIGSERIAL PRIMARY KEY,
    answer_id   BIGINT    NOT NULL REFERENCES answers(id) ON DELETE CASCADE,
    user_id     UUID      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vote_type   VARCHAR(20) NOT NULL CHECK (vote_type IN ('THUMBS_UP', 'THUMBS_DOWN')),
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_answer_vote UNIQUE(answer_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_answer_votes_answer_id ON answer_votes(answer_id);
CREATE INDEX IF NOT EXISTS idx_answer_votes_user_id ON answer_votes(user_id);
