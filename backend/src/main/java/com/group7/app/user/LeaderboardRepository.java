package com.group7.app.user;

import com.group7.app.lesson.model.UserLessonProgress;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface LeaderboardRepository extends JpaRepository<UserLessonProgress, Long> {

  @Query(
      """
      SELECT new com.group7.app.user.LeaderboardEntry(
          u.id, u.displayName, u.avatarColor, u.avatarPath,
          COALESCE(SUM(p.bestScore), 0L),
          u.completedLessonsCount,
          u.maxCorrectStreak,
          CASE WHEN u.completedLessonsCount > 0
               THEN 1.0 * u.totalTimeSeconds / u.completedLessonsCount
               ELSE NULL END
      )
      FROM User u
      LEFT JOIN UserLessonProgress p ON u.id = p.userId
      WHERE u.role = com.group7.app.user.Role.LEARNER
      GROUP BY u.id, u.displayName, u.avatarColor, u.avatarPath, u.maxCorrectStreak, u.totalTimeSeconds, u.completedLessonsCount
      ORDER BY
        CASE WHEN :sortBy = 'points' THEN SUM(p.bestScore) END DESC NULLS LAST,
        CASE WHEN :sortBy = 'streak' THEN u.maxCorrectStreak END DESC NULLS LAST,
        CASE WHEN :sortBy = 'speed' THEN
            CASE WHEN u.completedLessonsCount > 0
                 THEN 1.0 * u.totalTimeSeconds / u.completedLessonsCount
                 ELSE 9999999.0 END
        END ASC,
        SUM(p.bestScore) DESC
  """)
  List<LeaderboardEntry> getTopPlayers(@Param("sortBy") String sortBy, Pageable pageable);
}
