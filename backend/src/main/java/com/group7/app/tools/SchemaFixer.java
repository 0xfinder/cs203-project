package com.group7.app.tools;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

@Component
public class SchemaFixer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SchemaFixer.class);
    private final DataSource dataSource;

    public SchemaFixer(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Override
    public void run(ApplicationArguments args) {
        String a = "ALTER TABLE IF EXISTS public.questions ALTER COLUMN title TYPE TEXT";
        String b = "ALTER TABLE IF EXISTS public.questions ALTER COLUMN author TYPE TEXT";
        String cSql = "ALTER TABLE IF EXISTS public.questions ALTER COLUMN content TYPE TEXT";
        String infoSql = "SELECT column_name, data_type, character_maximum_length FROM information_schema.columns WHERE table_schema='public' AND table_name='questions' AND column_name IN ('title','author','content')";
        try (Connection c = dataSource.getConnection(); Statement s = c.createStatement()) {
            // log current types
            try (var rs = s.executeQuery(infoSql)) {
                while (rs.next()) {
                    log.info("Before: column={} data_type={} char_max={}", rs.getString("column_name"), rs.getString("data_type"), rs.getObject("character_maximum_length"));
                }
            } catch (SQLException ex) {
                log.debug("Could not read information_schema before alter", ex);
            }

            s.execute(a);
            s.execute(b);
            s.execute(cSql);

            // ensure storage policies for forum-media allow authenticated inserts/selects
            String dropInsertPolicy = "DROP POLICY IF EXISTS allow_authenticated_insert_forum_media ON storage.objects";
            String createInsertPolicy = "CREATE POLICY allow_authenticated_insert_forum_media ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'forum-media' AND auth.role() = 'authenticated')";
            String dropSelectPolicy = "DROP POLICY IF EXISTS allow_authenticated_select_forum_media ON storage.objects";
            String createSelectPolicy = "CREATE POLICY allow_authenticated_select_forum_media ON storage.objects FOR SELECT USING (bucket_id = 'forum-media')";

            try {
                s.execute(dropInsertPolicy);
                s.execute(createInsertPolicy);
                s.execute(dropSelectPolicy);
                s.execute(createSelectPolicy);
                log.info("SchemaFixer: storage policies for forum-media applied");
            } catch (SQLException ex) {
                log.warn("SchemaFixer: failed to apply storage policies", ex);
            }
            // log types after
            try (var rs = s.executeQuery(infoSql)) {
                while (rs.next()) {
                    log.info("After: column={} data_type={} char_max={}", rs.getString("column_name"), rs.getString("data_type"), rs.getObject("character_maximum_length"));
                }
            } catch (SQLException ex) {
                log.debug("Could not read information_schema after alter", ex);
            }

            log.info("SchemaFixer: attempted to ensure questions.title and questions.author are TEXT");
        } catch (SQLException e) {
            log.warn("SchemaFixer: failed to alter questions columns", e);
        }
    }
}
