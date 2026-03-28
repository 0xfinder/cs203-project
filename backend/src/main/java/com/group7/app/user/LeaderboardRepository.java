package com.group7.app.user;

import com.group7.app.lesson.model.UserLessonProgress;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

@Repository
public interface LeaderboardRepository extends JpaRepository<UserLessonProgress, Long> {

  @Query(
      """
      SELECT new com.group7.app.user.LeaderboardEntry(
          u.id, u.displayName, u.avatarColor, u.avatarPath,
          SUM(p.bestScore), COUNT(p.completedAt)
      )
      FROM User u
      LEFT JOIN UserLessonProgress p ON u.id = p.userId
      GROUP BY u.id, u.displayName, u.avatarColor, u.avatarPath
      ORDER BY SUM(p.bestScore) DESC NULLS LAST, COUNT(p.completedAt) DESC
  """)
  List<LeaderboardEntry> getTopPlayers(Pageable pageable);
}
