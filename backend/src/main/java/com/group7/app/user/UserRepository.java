package com.group7.app.user;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, UUID> {
  Optional<User> findByEmailIgnoreCase(String email);

  @Query("select u from User u where lower(u.email) in :emails")
  List<User> findAllByEmailLowercaseIn(@Param("emails") Collection<String> emails);

  boolean existsByEmailIgnoreCase(String email);

  Optional<User> findFirstByDisplayNameIgnoreCase(String displayName);
}
