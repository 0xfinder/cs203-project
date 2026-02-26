export interface Question {
  id: string;
  type: "multiple-choice" | "translate" | "match";
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
}

export interface Lesson {
  id: string;
  title: string;
  description: string;
  level: number;
  questions: Question[];
  icon: string;
  // tailwind gradient classes applied to the lesson node
  color: string;
}

export const lessons: Lesson[] = [
  {
    id: "basics",
    title: "The Basics",
    description: "Learn essential Gen Alpha terms",
    level: 1,
    icon: "🌟",
    color: "from-green-400 to-emerald-500",
    questions: [
      {
        id: "q1",
        type: "multiple-choice",
        question: 'What does "rizz" mean?',
        options: ["Charisma or flirting ability", "Being tired", "A type of food", "Running fast"],
        correctAnswer: "Charisma or flirting ability",
        explanation:
          '"Rizz" means charisma, especially when it comes to attracting romantic interest. Ex: "He\'s got rizz!"',
      },
      {
        id: "q2",
        type: "multiple-choice",
        question: 'If something is "bussin", it is...',
        options: ["Really good", "Broken", "Expensive", "Boring"],
        correctAnswer: "Really good",
        explanation:
          '"Bussin" means something is really good, especially when talking about food. Ex: "This pizza is bussin!"',
      },
      {
        id: "q3",
        type: "multiple-choice",
        question: 'What does "cap" mean?',
        options: ["A lie", "A hat", "The truth", "Money"],
        correctAnswer: "A lie",
        explanation:
          '"Cap" means a lie. "No cap" means you\'re telling the truth. Ex: "That\'s cap!" or "No cap, this is the best game ever."',
      },
      {
        id: "q4",
        type: "multiple-choice",
        question: 'When someone says you "slay", they mean you...',
        options: ["Did something really well", "Are being mean", "Need to sleep", "Are confused"],
        correctAnswer: "Did something really well",
        explanation:
          '"Slay" means you did something impressively or looked amazing. Ex: "You totally slayed that presentation!"',
      },
      {
        id: "q5",
        type: "multiple-choice",
        question: 'If something is "mid", it is...',
        options: ["Average or mediocre", "The best", "In the middle of the room", "Very expensive"],
        correctAnswer: "Average or mediocre",
        explanation:
          '"Mid" means something is average, mediocre, or not impressive. Ex: "That movie was mid."',
      },
    ],
  },
  {
    id: "slang-master",
    title: "Slang Master",
    description: "Advanced Gen Alpha vocabulary",
    level: 2,
    icon: "🔥",
    color: "from-orange-400 to-red-500",
    questions: [
      {
        id: "q1",
        type: "multiple-choice",
        question: 'What does "gyat" express?',
        options: ["Surprise or admiration", "Anger", "Hunger", "Confusion"],
        correctAnswer: "Surprise or admiration",
        explanation:
          '"Gyat" (or "gyatt") is an exclamation of surprise, often used when seeing someone attractive.',
      },
      {
        id: "q2",
        type: "multiple-choice",
        question: 'Someone with "aura" has...',
        options: ["A strong presence or vibe", "A halo", "Bad breath", "Lots of money"],
        correctAnswer: "A strong presence or vibe",
        explanation:
          '"Aura" refers to someone\'s presence, vibe, or charisma. Often used with points: "That move gave you +1000 aura."',
      },
      {
        id: "q3",
        type: "multiple-choice",
        question: 'What is "fanum tax"?',
        options: ["Taking someone's food", "A type of tax", "A dance move", "Being late"],
        correctAnswer: "Taking someone's food",
        explanation:
          '"Fanum tax" means taking a portion of someone else\'s food, named after streamer Fanum who would do this to friends.',
      },
      {
        id: "q4",
        type: "multiple-choice",
        question: 'If you\'re "delulu", you are...',
        options: ["Delusional", "Delicious", "Delayed", "Deleted"],
        correctAnswer: "Delusional",
        explanation:
          '"Delulu" is short for delusional, often used playfully. Ex: "I\'m delulu thinking he likes me."',
      },
      {
        id: "q5",
        type: "multiple-choice",
        question: 'A "sigma" is someone who is...',
        options: [
          "Independent and self-reliant",
          "Always sleeping",
          "Very loud",
          "Afraid of everything",
        ],
        correctAnswer: "Independent and self-reliant",
        explanation:
          '"Sigma" refers to someone who is independent and doesn\'t follow the crowd, part of the "alpha/beta/sigma" hierarchy meme.',
      },
    ],
  },
  {
    id: "internet-culture",
    title: "Internet Culture",
    description: "Master online Gen Alpha speak",
    level: 3,
    icon: "💻",
    color: "from-purple-400 to-pink-500",
    questions: [
      {
        id: "q1",
        type: "multiple-choice",
        question: 'What does it mean to "ratio" someone?',
        options: [
          "Your reply gets more likes than their post",
          "To measure something",
          "To block them",
          "To follow them",
        ],
        correctAnswer: "Your reply gets more likes than their post",
        explanation:
          'Getting "ratioed" means someone\'s reply to your post got more likes/engagement than your original post, usually indicating disagreement.',
      },
      {
        id: "q2",
        type: "multiple-choice",
        question: 'If you "stan" someone, you...',
        options: ["Are a devoted fan", "Dislike them", "Stand near them", "Ignore them"],
        correctAnswer: "Are a devoted fan",
        explanation:
          '"Stan" means to be a big fan of someone, from the Eminem song. Ex: "I stan Taylor Swift."',
      },
      {
        id: "q3",
        type: "multiple-choice",
        question: 'Something "sus" is...',
        options: ["Suspicious", "Super", "Sustainable", "Successful"],
        correctAnswer: "Suspicious",
        explanation:
          '"Sus" is short for suspicious. Made popular by Among Us. Ex: "That\'s kinda sus."',
      },
      {
        id: "q4",
        type: "multiple-choice",
        question: 'Saying something is "lowkey" means...',
        options: ["Subtly or somewhat", "Very loudly", "Not at all", "Extremely"],
        correctAnswer: "Subtly or somewhat",
        explanation:
          '"Lowkey" means subtly, somewhat, or to a small degree. Ex: "I lowkey love this song." The opposite is "highkey".',
      },
      {
        id: "q5",
        type: "multiple-choice",
        question: 'If someone is "based", they are...',
        options: ["Authentic and admirable", "Basic", "In a basement", "Confused"],
        correctAnswer: "Authentic and admirable",
        explanation:
          '"Based" means authentic, not caring what others think, or having admirable opinions. Ex: "That\'s a based take."',
      },
    ],
  },
  {
    id: "meme-legends",
    title: "Meme Legends",
    description: "Understand viral Gen Alpha memes",
    level: 4,
    icon: "😎",
    color: "from-blue-400 to-cyan-500",
    questions: [
      {
        id: "q1",
        type: "multiple-choice",
        question: 'What does "skibidi" refer to?',
        options: ["A viral meme series", "A dance", "A food", "A place"],
        correctAnswer: "A viral meme series",
        explanation:
          '"Skibidi" comes from the Skibidi Toilet meme series. It\'s used in phrases like "skibidi rizz" as a playful intensifier.',
      },
      {
        id: "q2",
        type: "multiple-choice",
        question: 'If something is "Ohio", it is...',
        options: ["Weird or bizarre", "From Ohio", "Perfect", "Fast"],
        correctAnswer: "Weird or bizarre",
        explanation:
          'Calling something "Ohio" means it\'s weird or bizarre, from memes about Ohio being strange. Ex: "Only in Ohio."',
      },
      {
        id: "q3",
        type: "multiple-choice",
        question: 'What is a "vibe check"?',
        options: ["Assessing someone's mood or energy", "A health exam", "A test", "A video game"],
        correctAnswer: "Assessing someone's mood or energy",
        explanation:
          'A "vibe check" means checking on someone\'s mood, energy, or state of mind. Ex: "You good? Just doing a vibe check."',
      },
      {
        id: "q4",
        type: "multiple-choice",
        question: "When you're in your \"___ era\", you're...",
        options: [
          "Going through a specific phase",
          "In a different time period",
          "Aging backwards",
          "Era means error",
        ],
        correctAnswer: "Going through a specific phase",
        explanation:
          'Being in your "___ era" means you\'re going through a specific phase or vibe. Ex: "I\'m in my villain era" or "main character era".',
      },
      {
        id: "q5",
        type: "multiple-choice",
        question: 'What does "ghosting" mean?',
        options: [
          "Suddenly stopping communication",
          "Seeing ghosts",
          "Being invisible",
          "Playing a game",
        ],
        correctAnswer: "Suddenly stopping communication",
        explanation:
          '"Ghosting" means suddenly cutting off all communication with someone without explanation, like disappearing like a ghost.',
      },
    ],
  },
];
