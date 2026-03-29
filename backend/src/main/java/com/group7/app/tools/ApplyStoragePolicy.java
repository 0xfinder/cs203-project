package com.group7.app.tools;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.HashMap;
import java.util.Map;

public class ApplyStoragePolicy {
  public static void main(String[] args) {
    try {
      Map<String, String> env = readDotEnv(".env");
      String jdbcUrl = env.get("SUPABASE_DB_URL");
      String user = env.get("SUPABASE_DB_USERNAME");
      String pass = env.get("SUPABASE_DB_PASSWORD");
      if (jdbcUrl == null || user == null || pass == null) {
        System.err.println("Missing DB credentials in .env");
        System.exit(2);
      }

      // jdbc url in .env may be jdbc:postgresql://host:port/db
      System.out.println("Connecting to " + jdbcUrl);
      try (Connection c = DriverManager.getConnection(jdbcUrl, user, pass)) {
        applyPolicy(c);
      }

      System.out.println("Policies applied successfully.");
    } catch (Exception e) {
      e.printStackTrace();
      System.exit(1);
    }
  }

  private static Map<String, String> readDotEnv(String file) throws IOException {
    Map<String, String> map = new HashMap<>();
    Path p = Path.of(file);
    if (!Files.exists(p)) return map;
    for (String line : Files.readAllLines(p)) {
      line = line.trim();
      if (line.isEmpty() || line.startsWith("#")) continue;
      int idx = line.indexOf('=');
      if (idx <= 0) continue;
      String k = line.substring(0, idx).trim();
      String v = line.substring(idx + 1).trim();
      // strip surrounding quotes
      if (v.length() >= 2
          && ((v.startsWith("\'") && v.endsWith("\'"))
              || (v.startsWith("\"") && v.endsWith("\"")))) {
        v = v.substring(1, v.length() - 1);
      }
      map.put(k, v);
    }
    return map;
  }

  private static void applyPolicy(Connection c) throws SQLException {
    String policy1 =
        "CREATE POLICY IF NOT EXISTS \"Allow authenticated uploads to forum-media\" "
            + "ON storage.objects FOR INSERT "
            + "USING (bucket_id = 'forum-media' AND auth.role() = 'authenticated') "
            + "WITH CHECK (bucket_id = 'forum-media' AND auth.role() = 'authenticated');";

    String policy2 =
        "CREATE POLICY IF NOT EXISTS \"Allow select for forum-media\" "
            + "ON storage.objects FOR SELECT "
            + "USING (bucket_id = 'forum-media');";

    try (Statement s = c.createStatement()) {
      s.execute(policy1);
      s.execute(policy2);
    }
  }
}
