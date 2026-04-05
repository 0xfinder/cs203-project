#!/usr/bin/env python3
import re
import os

# Use forward slashes for path
file_path = 'c:/CSD/cs203-project/frontend/src/routes/lesson.$lessonId.tsx'
file_path = os.path.normpath(file_path)

print(f"Reading file: {file_path}")
print(f"File exists: {os.path.exists(file_path)}")

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

print(f"File size: {len(content)} bytes")

# Task 1: Replace the question type display strings (both occurrences)
old_pattern = 'questionType === "MCQ" ? "Multiple Choice" : "Short Answer"'
new_pattern = 'questionType === "MCQ" ? "Multiple Choice" : questionType === "MATCH" ? "Matching" : "Short Answer"'

count_before = content.count(old_pattern)
content = content.replace(old_pattern, new_pattern)
count_after = content.count(old_pattern)

print(f"Task 1: Replaced question type strings - found {count_before} occurrences, {count_before - count_after} replaced")

# Task 2: Add MATCH blocks after MCQ blocks
match_block = '''                  {questionType === "MATCH" && (
                    <div>
                      <label className="block text-sm font-medium mb-2">Match pairs (Left → Right)</label>
                      <div className="space-y-2">
                        {qMatchPairs.map((pair, idx) => (
                          <div key={pair.id} className="flex gap-2 items-end">
                            <div className="flex-1">
                              <input
                                type="text"
                                className="w-full rounded-md border bg-background px-3 py-2"
                                value={pair.left}
                                onChange={(e) => {
                                  const updated = [...qMatchPairs];
                                  updated[idx] = { ...pair, left: e.target.value };
                                  setQMatchPairs(updated);
                                }}
                                placeholder={`Term ${idx + 1}`}
                              />
                            </div>
                            <span className="text-muted-foreground">→</span>
                            <div className="flex-1">
                              <input
                                type="text"
                                className="w-full rounded-md border bg-background px-3 py-2"
                                value={pair.right}
                                onChange={(e) => {
                                  const updated = [...qMatchPairs];
                                  updated[idx] = { ...pair, right: e.target.value };
                                  setQMatchPairs(updated);
                                }}
                                placeholder={`Definition ${idx + 1}`}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => setQMatchPairs(qMatchPairs.filter((_, i) => i !== idx))}
                              className="text-sm text-red-500 hover:underline whitespace-nowrap"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            setQMatchPairs([...qMatchPairs, { left: "", right: "", id: String(Date.now()) }])
                          }
                          className="text-sm text-blue-500 hover:underline"
                        >
                          + Add pair
                        </button>
                      </div>
                    </div>
                  )}

'''

# Find all locations where MCQ block ends (+ Add choice)
mcq_end_marker = '+ Add choice\n                        </button>'
match_count = 0

# Find positions of MCQ blocks
mcq_positions = []
search_pos = 0
while True:
    pos = content.find(mcq_end_marker, search_pos)
    if pos == -1:
        break
    mcq_positions.append(pos)
    search_pos = pos + 1

print(f"Task 2: Found {len(mcq_positions)} MCQ blocks")

# Process MCQ blocks from end to start (to maintain positions)
for pos in reversed(mcq_positions):
    # Find the closing } after this MCQ block
    search_start = pos + len(mcq_end_marker)
    
    # Find the first "\n                  })" after the marker
    pattern_to_find = '\n                      </div>\n                    </div>\n                  })'
    close_pos = content.find(pattern_to_find, search_start)
    
    if close_pos != -1:
        # Check if MATCH block is already there
        next_part = content[close_pos + len(pattern_to_find):close_pos + len(pattern_to_find) + 200]
        if 'questionType === "MATCH"' not in next_part:
            # Insert MATCH block
            insert_pos = close_pos + len(pattern_to_find)
            content = content[:insert_pos] + '\n\n' + match_block + content[insert_pos:]
            match_count += 1

print(f"Task 2: Added {match_count} MATCH blocks")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('All replacements complete!')

