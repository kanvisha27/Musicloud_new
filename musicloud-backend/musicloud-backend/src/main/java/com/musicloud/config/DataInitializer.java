package com.musicloud.config;

import com.musicloud.model.UserEntity;
import com.musicloud.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.UUID;

/**
 * Database initializer — runs once when the Spring Boot app starts.
 *
 * WHAT IT DOES:
 *   - Creates the default "admin" account if it doesn't already exist.
 *   - Admin username: admin
 *   - ADMIN_PASSWORD sets the initial password; the local default remains "admin".
 *
 * Set ADMIN_PASSWORD in production; the local default remains "admin".
 */
@Configuration
public class DataInitializer {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    @Bean
    public CommandLineRunner seedAdminUser(UserRepository userRepo, PasswordEncoder encoder,
                                           @Value("${admin.password}") String adminPassword) {
        return args -> {
            if (adminPassword.isBlank()) {
                throw new IllegalStateException("ADMIN_PASSWORD must not be blank.");
            }
            if (!userRepo.existsByUsername("admin")) {
                UserEntity admin = new UserEntity();
                admin.setId(UUID.randomUUID().toString());
                admin.setEmail("admin@musicloud.local");
                admin.setUsername("admin");
                admin.setFirstName("Admin");
                admin.setLastName("User");
                admin.setRole(UserEntity.Role.ADMIN);
                admin.setPassword(encoder.encode(adminPassword));
                userRepo.save(admin);
                log.info("[Init] Admin account created. Username: admin");
            } else {
                userRepo.findByUsername("admin").ifPresent(admin -> {
                    if (admin.getPassword() != null
                            && encoder.matches("admin", admin.getPassword())
                            && !"admin".equals(adminPassword)) {
                        admin.setPassword(encoder.encode(adminPassword));
                        userRepo.save(admin);
                        log.info("[Init] Replaced the default admin password with ADMIN_PASSWORD.");
                    } else {
                        log.info("[Init] Admin account already exists.");
                    }
                });
            }
        };
    }
}
