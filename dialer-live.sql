-- MySQL dump 10.13  Distrib 8.0.46, for Linux (x86_64)
--
-- Host: localhost    Database: dialer
-- ------------------------------------------------------
-- Server version	8.0.46-0ubuntu0.24.04.3

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `dialer`
--

/*!40000 DROP DATABASE IF EXISTS `dialer`*/;

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `dialer` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `dialer`;

--
-- Table structure for table `agent_sessions`
--

DROP TABLE IF EXISTS `agent_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `agent_sessions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int NOT NULL,
  `login_at` datetime NOT NULL,
  `logout_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_agent_sessions_emp` (`employee_id`,`login_at`),
  CONSTRAINT `fk_agent_sessions_user` FOREIGN KEY (`employee_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=46 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `agent_sessions`
--

LOCK TABLES `agent_sessions` WRITE;
/*!40000 ALTER TABLE `agent_sessions` DISABLE KEYS */;
INSERT INTO `agent_sessions` VALUES (1,22,'2026-06-24 17:20:37','2026-06-24 17:29:28','2026-06-24 17:20:37'),(2,22,'2026-06-24 17:30:52','2026-06-24 18:01:43','2026-06-24 17:30:52'),(3,22,'2026-06-24 18:02:40','2026-06-24 18:32:53','2026-06-24 18:02:40'),(4,22,'2026-06-24 18:32:53','2026-06-24 22:03:53','2026-06-24 18:32:53'),(5,23,'2026-06-24 21:24:53','2026-06-24 22:00:08','2026-06-24 21:24:53'),(6,22,'2026-06-24 22:03:53','2026-06-24 22:04:51','2026-06-24 22:03:53'),(7,24,'2026-06-24 22:05:54','2026-06-24 22:11:47','2026-06-24 22:05:54'),(8,24,'2026-06-24 22:11:47',NULL,'2026-06-24 22:11:47'),(9,23,'2026-06-26 14:53:35','2026-06-27 16:05:43','2026-06-26 14:53:35'),(10,25,'2026-06-26 14:56:31',NULL,'2026-06-26 14:56:31'),(11,23,'2026-06-27 16:05:43','2026-06-27 18:35:40','2026-06-27 16:05:43'),(12,23,'2026-06-27 18:35:41','2026-06-27 18:40:49','2026-06-27 18:35:41'),(13,23,'2026-06-27 18:40:49','2026-06-27 20:22:52','2026-06-27 18:40:49'),(14,23,'2026-06-27 20:28:34','2026-06-27 20:28:51','2026-06-27 20:28:34'),(15,23,'2026-06-27 20:31:35','2026-06-27 20:31:44','2026-06-27 20:31:35'),(16,22,'2026-06-28 00:20:20','2026-06-28 00:22:13','2026-06-28 00:20:20'),(17,23,'2026-06-28 02:24:07','2026-06-28 02:29:50','2026-06-28 02:24:07'),(18,23,'2026-06-28 02:29:50','2026-07-04 15:50:28','2026-06-28 02:29:50'),(19,23,'2026-07-04 15:50:28','2026-07-07 13:00:04','2026-07-04 15:50:28'),(20,23,'2026-07-07 13:00:04','2026-07-07 13:09:17','2026-07-07 13:00:04'),(21,23,'2026-07-07 13:09:17','2026-07-11 14:52:08','2026-07-07 13:09:17'),(22,23,'2026-07-11 14:52:08','2026-07-11 14:54:43','2026-07-11 14:52:08'),(23,23,'2026-07-11 14:54:43','2026-07-25 14:54:16','2026-07-11 14:54:43'),(24,23,'2026-07-25 14:54:17','2026-07-25 15:07:51','2026-07-25 14:54:17'),(25,23,'2026-07-25 15:07:51','2026-07-31 22:04:45','2026-07-25 15:07:51'),(26,23,'2026-07-31 22:04:45','2026-07-31 22:16:49','2026-07-31 22:04:45'),(27,23,'2026-07-31 22:16:49','2026-08-01 02:46:37','2026-07-31 22:16:49'),(28,22,'2026-08-01 02:47:03','2026-08-02 12:16:33','2026-08-01 02:47:03'),(29,23,'2026-08-01 15:27:35','2026-08-02 21:11:47','2026-08-01 15:27:35'),(30,22,'2026-08-02 12:16:33','2026-08-02 14:17:51','2026-08-02 12:16:33'),(31,22,'2026-08-02 14:17:51','2026-08-02 16:18:48','2026-08-02 14:17:51'),(32,22,'2026-08-02 16:19:35',NULL,'2026-08-02 16:19:35'),(33,23,'2026-08-02 21:11:47','2026-08-03 13:41:47','2026-08-02 21:11:47'),(34,23,'2026-08-03 13:41:47','2026-08-03 13:52:42','2026-08-03 13:41:47'),(35,23,'2026-08-03 13:52:42','2026-08-03 13:56:35','2026-08-03 13:52:42'),(36,23,'2026-08-03 13:56:35','2026-08-03 14:00:42','2026-08-03 13:56:35'),(37,23,'2026-08-03 14:00:42','2026-08-03 14:02:25','2026-08-03 14:00:42'),(38,23,'2026-08-03 14:02:25','2026-08-03 14:13:08','2026-08-03 14:02:25'),(39,23,'2026-08-03 22:53:21','2026-08-03 23:20:12','2026-08-03 22:53:21'),(40,23,'2026-08-03 23:20:12','2026-08-04 13:52:14','2026-08-03 23:20:12'),(41,23,'2026-08-04 13:52:14','2026-08-04 14:03:55','2026-08-04 13:52:14'),(42,23,'2026-08-04 14:03:55','2026-08-05 12:01:45','2026-08-04 14:03:55'),(43,23,'2026-08-05 12:01:45','2026-08-05 12:10:02','2026-08-05 12:01:45'),(44,23,'2026-08-05 12:10:02','2026-08-05 13:09:02','2026-08-05 12:10:02'),(45,23,'2026-08-05 18:39:40',NULL,'2026-08-05 18:39:40');
/*!40000 ALTER TABLE `agent_sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attendance_sessions`
--

DROP TABLE IF EXISTS `attendance_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attendance_sessions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `role` enum('admin','manager','tl','employee') NOT NULL,
  `tl_id` int DEFAULT NULL COMMENT 'Assigned TL (users.reports_to) snapshot at login',
  `shift_id` int DEFAULT NULL COMMENT 'Assigned shift snapshot at login',
  `work_date` date NOT NULL COMMENT 'IST calendar day of the login',
  `login_at` datetime NOT NULL COMMENT 'IST wall-clock login time',
  `logout_at` datetime DEFAULT NULL COMMENT 'IST wall-clock logout time',
  `duration_seconds` int DEFAULT NULL,
  `status` enum('on_time','grace','late') DEFAULT NULL COMMENT 'Punctuality vs shift; NULL = no shift assigned',
  `late_seconds` int NOT NULL DEFAULT '0',
  `logout_reason` enum('manual','timeout','force','expired') DEFAULT NULL,
  `ip` varchar(64) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `session_id` varchar(64) DEFAULT NULL,
  `last_seen_at` datetime DEFAULT NULL COMMENT 'Heartbeat — powers online detection & stale-session sweep',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_att_user_date` (`user_id`,`work_date`),
  KEY `idx_att_date_status` (`work_date`,`status`),
  KEY `idx_att_shift` (`shift_id`),
  KEY `idx_att_status` (`status`),
  KEY `idx_att_open` (`logout_at`),
  KEY `idx_att_tl_date` (`tl_id`,`work_date`),
  KEY `idx_att_date_login` (`work_date`,`login_at`),
  CONSTRAINT `fk_att_shift` FOREIGN KEY (`shift_id`) REFERENCES `shifts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_att_tl` FOREIGN KEY (`tl_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_att_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=60 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attendance_sessions`
--

LOCK TABLES `attendance_sessions` WRITE;
/*!40000 ALTER TABLE `attendance_sessions` DISABLE KEYS */;
INSERT INTO `attendance_sessions` VALUES (1,22,'employee',NULL,NULL,'2026-06-28','2026-06-28 00:20:20','2026-06-28 00:22:13',113,NULL,0,'manual','::ffff:192.168.3.205','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36','126d6cfb-4dae-4779-90e9-ec199da98423','2026-06-28 00:22:13','2026-06-28 00:20:20'),(2,1,'admin',NULL,NULL,'2026-06-28','2026-06-28 02:20:03','2026-06-28 02:23:37',214,NULL,0,'manual','::ffff:100.75.171.84','Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36','3e1d3d19-f336-4d72-a321-65dc94484f20','2026-06-28 02:23:37','2026-06-28 02:20:03'),(3,23,'employee',NULL,NULL,'2026-06-28','2026-06-28 02:24:07','2026-06-28 02:27:10',183,NULL,0,'expired','::ffff:100.75.171.84','Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36','b54275dd-fc5c-4a31-beb6-74f9cf313041','2026-06-28 02:27:10','2026-06-28 02:24:07'),(4,23,'employee',NULL,NULL,'2026-06-28','2026-06-28 02:29:50','2026-06-28 02:34:00',250,NULL,0,'expired','::ffff:100.75.171.84','Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36','f1bd15ae-700e-47a4-a40b-f7af47e2edc6','2026-06-28 02:34:00','2026-06-28 02:29:50'),(5,1,'admin',NULL,NULL,'2026-07-04','2026-07-04 14:51:41','2026-07-04 16:38:30',6409,NULL,0,'expired','::ffff:192.168.2.2','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36','c978a9ca-57fd-4199-8db0-646500a5882e','2026-07-04 16:38:30','2026-07-04 14:51:41'),(6,23,'employee',NULL,NULL,'2026-07-04','2026-07-04 15:50:28','2026-07-04 16:38:27',2879,NULL,0,'expired','::ffff:192.168.2.2','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36','6f8decf1-60be-45bc-a14e-a5ab7f1992e6','2026-07-04 16:38:27','2026-07-04 15:50:28'),(7,1,'admin',NULL,NULL,'2026-07-07','2026-07-07 12:58:20','2026-07-07 13:13:04',884,NULL,0,'expired','::ffff:192.168.3.205','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36','2f615c7d-bf2b-4ea7-bf2d-3538c7974393','2026-07-07 13:13:04','2026-07-07 12:58:20'),(8,23,'employee',NULL,NULL,'2026-07-07','2026-07-07 13:00:04','2026-07-07 13:03:11',187,NULL,0,'expired','::ffff:192.168.3.205','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36','764eb9f8-fe7b-49cd-84b4-a0ea2ecff69c','2026-07-07 13:03:11','2026-07-07 13:00:04'),(9,23,'employee',NULL,NULL,'2026-07-07','2026-07-07 13:09:17','2026-07-07 13:12:45',208,NULL,0,'expired','::ffff:192.168.3.205','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36','af721d2c-b21a-4457-bb08-faf1b94d5632','2026-07-07 13:12:45','2026-07-07 13:09:17'),(10,1,'admin',NULL,NULL,'2026-07-08','2026-07-08 01:03:10','2026-07-08 01:03:11',1,NULL,0,'expired','::ffff:100.75.171.84','Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36','d98d4ce3-2689-4a4a-8095-815a8f48ea7a','2026-07-08 01:03:11','2026-07-08 01:03:10'),(11,1,'admin',NULL,NULL,'2026-07-11','2026-07-11 14:51:21','2026-07-11 14:51:48',27,NULL,0,'manual','::ffff:100.75.171.84','Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36','b49002a6-6f0a-4027-8da8-171aaa019e07','2026-07-11 14:51:48','2026-07-11 14:51:21'),(12,23,'employee',NULL,NULL,'2026-07-11','2026-07-11 14:52:08','2026-07-11 14:53:10',62,NULL,0,'expired','::ffff:100.75.171.84','Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36','5a66abdb-c844-4d7b-a3ce-816fbe1be6a5','2026-07-11 14:53:10','2026-07-11 14:52:08'),(13,23,'employee',NULL,NULL,'2026-07-11','2026-07-11 14:54:43','2026-07-11 14:59:21',278,NULL,0,'expired','::ffff:100.75.171.84','Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36','4ce9057c-2e3c-48df-9338-6ea2ff1eb3a8','2026-07-11 14:59:21','2026-07-11 14:54:43'),(14,1,'admin',NULL,NULL,'2026-07-23','2026-07-23 16:27:52','2026-07-23 22:37:41',22189,NULL,0,'expired','::ffff:192.168.3.205','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','07536e11-4d77-4c25-b2b0-26095e162f92','2026-07-23 22:37:41','2026-07-23 16:27:52'),(15,1,'admin',NULL,NULL,'2026-07-25','2026-07-25 01:17:19','2026-07-25 02:31:58',4479,NULL,0,'expired','::ffff:192.168.3.205','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','5896e966-fc61-4012-8816-0d82d4f5fc6a','2026-07-25 02:31:58','2026-07-25 01:17:19'),(16,1,'admin',NULL,NULL,'2026-07-25','2026-07-25 02:32:15','2026-07-25 02:47:23',908,NULL,0,'expired','::ffff:192.168.3.205','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','4156bbb0-ea53-4ef9-aea8-c93a4d54e6bb','2026-07-25 02:47:23','2026-07-25 02:32:15'),(17,1,'admin',NULL,NULL,'2026-07-25','2026-07-25 02:47:29','2026-07-25 02:49:38',129,NULL,0,'expired','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','89fc0c46-8bfb-4533-b396-c315a8e1c023','2026-07-25 02:49:38','2026-07-25 02:47:29'),(18,1,'admin',NULL,NULL,'2026-07-25','2026-07-25 13:26:41','2026-07-25 14:11:00',2659,NULL,0,'expired','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','0b5de651-300e-4e1e-b6bc-b05b8e16202e','2026-07-25 14:11:00','2026-07-25 13:26:41'),(19,1,'admin',NULL,NULL,'2026-07-25','2026-07-25 14:11:03','2026-07-25 17:38:36',12453,NULL,0,'expired','::ffff:192.168.3.205','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','33b976e6-1be2-4138-b49c-dddc011adad0','2026-07-25 17:38:36','2026-07-25 14:11:03'),(20,23,'employee',NULL,NULL,'2026-07-25','2026-07-25 14:54:16','2026-07-25 15:02:43',507,NULL,0,'expired','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','f59e0e15-bde7-466b-b5b4-2424ae3cd456','2026-07-25 15:02:43','2026-07-25 14:54:19'),(21,23,'employee',NULL,NULL,'2026-07-25','2026-07-25 15:07:51','2026-07-25 18:30:37',12166,NULL,0,'expired','::ffff:192.168.3.205','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','5e365043-cdea-44d0-9135-cf69e262b124','2026-07-25 18:30:37','2026-07-25 15:07:51'),(22,1,'admin',NULL,NULL,'2026-07-25','2026-07-25 17:40:25','2026-07-25 18:06:43',1578,NULL,0,'expired','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','9e5fd9b2-aff9-407c-a6e0-4385041f8c8f','2026-07-25 18:06:43','2026-07-25 17:40:25'),(23,1,'admin',NULL,NULL,'2026-07-31','2026-07-31 22:03:49','2026-07-31 22:31:50',1681,NULL,0,'expired','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','16451b72-0866-4510-af01-b5429dab4720','2026-07-31 22:31:50','2026-07-31 22:03:49'),(24,23,'employee',NULL,NULL,'2026-07-31','2026-07-31 22:04:45','2026-07-31 22:15:51',666,NULL,0,'expired','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','eda6e433-2ffc-4410-8afb-47efeeb2e996','2026-07-31 22:15:51','2026-07-31 22:04:45'),(25,23,'employee',NULL,NULL,'2026-07-31','2026-07-31 22:16:49','2026-08-01 02:46:35',16186,NULL,0,'manual','::ffff:192.168.3.205','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','70312232-d1a3-4928-a639-4e915f16600e','2026-08-01 02:46:35','2026-07-31 22:16:49'),(26,1,'admin',NULL,NULL,'2026-07-31','2026-07-31 22:36:22','2026-08-01 02:46:28',15006,NULL,0,'manual','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','5feb4c03-a00e-46d6-b935-cd149f6eb56b','2026-08-01 02:46:28','2026-07-31 22:36:22'),(27,22,'employee',NULL,NULL,'2026-08-01','2026-08-01 02:47:03','2026-08-01 03:13:54',1611,NULL,0,'expired','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','f2d69f3e-15e6-459d-bbe9-9b0ad19b9f50','2026-08-01 03:13:54','2026-08-01 02:47:05'),(28,1,'admin',NULL,NULL,'2026-08-01','2026-08-01 15:26:14','2026-08-01 15:55:06',1732,NULL,0,'expired','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','d0d284d7-d70a-4137-9d6d-da5d4bf1cc0c','2026-08-01 15:55:06','2026-08-01 15:26:17'),(29,23,'employee',NULL,NULL,'2026-08-01','2026-08-01 15:27:35','2026-08-01 20:20:06',17551,NULL,0,'expired','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','5c676031-cf0b-4a6d-9c2c-2919433a0456','2026-08-01 20:20:06','2026-08-01 15:27:38'),(30,1,'admin',NULL,NULL,'2026-08-02','2026-08-02 12:15:53','2026-08-02 12:44:48',1735,NULL,0,'manual','::ffff:192.168.3.205','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','da30861b-298b-4af5-b5c3-54f69a67ffc5','2026-08-02 12:44:48','2026-08-02 12:15:53'),(31,22,'employee',NULL,NULL,'2026-08-02','2026-08-02 12:16:33','2026-08-02 14:17:36',7263,NULL,0,'expired','::ffff:192.168.3.205','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','888a6ffe-fc58-4ffa-b6e3-01fe0f842932','2026-08-02 14:17:36','2026-08-02 12:16:33'),(32,1,'admin',NULL,NULL,'2026-08-02','2026-08-02 12:44:51','2026-08-02 14:16:10',5479,NULL,0,'expired','::ffff:192.168.3.205','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','a848a5ea-ea12-4dae-b760-b03289feda3d','2026-08-02 14:16:10','2026-08-02 12:44:51'),(33,1,'admin',NULL,NULL,'2026-08-02','2026-08-02 14:16:40','2026-08-02 18:23:21',14801,NULL,0,'expired','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','d1033632-e325-4d4e-a4c7-fb3e5d761303','2026-08-02 18:23:21','2026-08-02 14:16:40'),(34,22,'employee',NULL,NULL,'2026-08-02','2026-08-02 14:17:51','2026-08-02 16:18:48',7257,NULL,0,'manual','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','7a9804a9-0ac0-4dc7-a008-d6ae02c6b4d5','2026-08-02 16:18:48','2026-08-02 14:17:51'),(35,22,'employee',NULL,NULL,'2026-08-02','2026-08-02 16:19:35','2026-08-02 18:23:21',7426,NULL,0,'expired','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','7baa765a-254d-4d5c-a831-d7b295a3105c','2026-08-02 18:23:21','2026-08-02 16:19:35'),(36,1,'admin',NULL,NULL,'2026-08-02','2026-08-02 21:11:19','2026-08-02 21:11:30',11,NULL,0,'manual','::ffff:100.75.171.84','Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36','93c64baa-b762-4004-b0ba-71d7f1a255dc','2026-08-02 21:11:30','2026-08-02 21:11:19'),(37,23,'employee',NULL,NULL,'2026-08-02','2026-08-02 21:11:47','2026-08-02 21:11:51',4,NULL,0,'expired','::ffff:100.75.171.84','Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36','2be0bfbd-7603-41f6-8f03-e33139f99272','2026-08-02 21:11:51','2026-08-02 21:11:47'),(38,1,'admin',NULL,NULL,'2026-08-03','2026-08-03 13:23:46','2026-08-03 13:52:19',1713,NULL,0,'expired','::ffff:192.168.2.2','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','a0528c64-05dc-4310-bb87-7b72852b787a','2026-08-03 13:52:19','2026-08-03 13:23:46'),(39,23,'employee',NULL,NULL,'2026-08-03','2026-08-03 13:41:47','2026-08-03 13:48:25',398,NULL,0,'expired','::ffff:192.168.2.19','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','b3ce9e46-7fbf-4443-b97c-9afa089fa41a','2026-08-03 13:48:25','2026-08-03 13:41:47'),(40,23,'employee',NULL,NULL,'2026-08-03','2026-08-03 13:52:42','2026-08-03 13:52:43',1,NULL,0,'expired','::ffff:192.168.2.20','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','4d5e70dd-cfd6-49c2-abeb-c353d1913656','2026-08-03 13:52:43','2026-08-03 13:52:42'),(41,1,'admin',NULL,NULL,'2026-08-03','2026-08-03 13:55:57','2026-08-03 14:20:06',1449,NULL,0,'expired','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','01cbbd3e-91c6-4946-9b66-9fb80dd8f196','2026-08-03 14:20:06','2026-08-03 13:55:58'),(42,23,'employee',NULL,NULL,'2026-08-03','2026-08-03 13:56:35','2026-08-03 14:00:22',227,NULL,0,'expired','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','6425bf68-375a-4651-ad8c-f4d2a7517d74','2026-08-03 14:00:22','2026-08-03 13:56:35'),(43,23,'employee',NULL,NULL,'2026-08-03','2026-08-03 14:00:42','2026-08-03 14:01:44',62,NULL,0,'expired','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','507dcf96-13f7-476c-bbe6-c5198ee19f6a','2026-08-03 14:01:44','2026-08-03 14:00:42'),(44,23,'employee',NULL,NULL,'2026-08-03','2026-08-03 14:02:25','2026-08-03 14:13:08',643,NULL,0,'manual','::ffff:192.168.3.205','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','b9145e01-e9ad-4231-ac69-fdd3282a8efe','2026-08-03 14:13:08','2026-08-03 14:02:25'),(45,1,'admin',NULL,NULL,'2026-08-03','2026-08-03 22:50:44','2026-08-03 23:16:05',1521,NULL,0,'expired','::ffff:192.168.3.205','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','d65bf29a-5f95-4251-9904-b5b3504212f1','2026-08-03 23:16:05','2026-08-03 22:50:44'),(46,23,'employee',NULL,NULL,'2026-08-03','2026-08-03 22:53:21','2026-08-03 23:15:49',1348,NULL,0,'expired','::ffff:192.168.3.205','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','f520381a-12e6-403f-8aa7-4953f98f675e','2026-08-03 23:15:49','2026-08-03 22:53:21'),(47,1,'admin',NULL,NULL,'2026-08-03','2026-08-03 23:19:11','2026-08-03 23:19:49',38,NULL,0,'manual','::ffff:192.168.3.205','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','b7d25838-6e53-4f45-b1a8-eb75e2b9aa17','2026-08-03 23:19:49','2026-08-03 23:19:11'),(48,23,'employee',NULL,NULL,'2026-08-03','2026-08-03 23:20:12','2026-08-03 23:20:13',1,NULL,0,'expired','::ffff:192.168.3.205','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','fb51f1d8-1178-485f-9335-97662a6a35a3','2026-08-03 23:20:13','2026-08-03 23:20:12'),(49,1,'admin',NULL,NULL,'2026-08-04','2026-08-04 13:51:49','2026-08-04 14:01:51',602,NULL,0,'expired','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','14d22e4a-665c-4bb3-ac1b-ae69d223bf73','2026-08-04 14:01:51','2026-08-04 13:51:49'),(50,23,'employee',NULL,NULL,'2026-08-04','2026-08-04 13:52:14','2026-08-04 14:03:32',678,NULL,0,'expired','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','ddb09e69-a220-4ad9-b229-f6bf15ad3b73','2026-08-04 14:03:32','2026-08-04 13:52:14'),(51,1,'admin',NULL,NULL,'2026-08-04','2026-08-04 14:02:05','2026-08-04 14:57:59',3354,NULL,0,'expired','::ffff:192.168.3.205','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','d7853659-7138-43a4-8f73-cbb744eb10dd','2026-08-04 14:57:59','2026-08-04 14:02:05'),(52,23,'employee',NULL,NULL,'2026-08-04','2026-08-04 14:03:55','2026-08-04 15:25:45',4910,NULL,0,'expired','::ffff:192.168.3.205','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','76edc32d-ccee-4810-8bdd-fdf01d909679','2026-08-04 15:25:45','2026-08-04 14:03:55'),(53,1,'admin',NULL,NULL,'2026-08-04','2026-08-04 14:58:48','2026-08-04 21:54:42',24954,NULL,0,'expired','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','b863009e-31fb-4d52-8960-36785c659390','2026-08-04 21:54:42','2026-08-04 14:58:48'),(54,23,'employee',NULL,NULL,'2026-08-05','2026-08-05 12:01:45','2026-08-05 12:09:46',481,NULL,0,'expired','::ffff:192.168.3.205','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2f87e8de-da49-4198-a47b-0757d701d7ac','2026-08-05 12:09:46','2026-08-05 12:01:45'),(55,23,'employee',NULL,NULL,'2026-08-05','2026-08-05 12:10:01','2026-08-05 13:09:02',3541,NULL,0,'manual','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','42afbde6-d2cd-4aaa-89b1-e02852c70c27','2026-08-05 13:09:02','2026-08-05 12:10:02'),(56,1,'admin',NULL,NULL,'2026-08-05','2026-08-05 12:26:37','2026-08-05 20:26:18',28781,NULL,0,'expired','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','65481188-ce57-46bf-aa43-787a41d9bc24','2026-08-05 20:26:18','2026-08-05 12:26:38'),(57,23,'employee',NULL,NULL,'2026-08-05','2026-08-05 18:39:40',NULL,NULL,NULL,0,NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','9250272a-9d20-4999-9415-a65e3bcfb983','2026-08-05 22:06:32','2026-08-05 18:39:40'),(58,1,'admin',NULL,NULL,'2026-08-05','2026-08-05 20:26:52','2026-08-05 22:06:32',5980,NULL,0,'expired','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','0ef8fe95-f8de-4a69-ba10-70dd97e98504','2026-08-05 22:06:32','2026-08-05 20:26:52'),(59,1,'admin',NULL,NULL,'2026-08-14','2026-08-14 15:32:12',NULL,NULL,NULL,0,NULL,'::ffff:192.168.3.205','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','5ef2f129-568b-4029-a86c-5f0c7dfbf756','2026-08-14 16:16:24','2026-08-14 15:32:12');
/*!40000 ALTER TABLE `attendance_sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `entity` varchar(60) DEFAULT NULL,
  `entity_id` int DEFAULT NULL,
  `details` json DEFAULT NULL,
  `ip` varchar(64) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_audit_user` (`user_id`),
  KEY `idx_audit_created` (`created_at`),
  CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=342 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
INSERT INTO `audit_logs` VALUES (1,1,'create_user','users',20,'{\"role\": \"tl\", \"email\": \"Deepak@gmail.com\"}','::ffff:192.168.3.205','2026-06-24 17:05:28'),(2,20,'login','users',20,NULL,'::ffff:192.168.3.205','2026-06-24 17:06:34'),(3,1,'create_user','users',21,'{\"role\": \"tl\", \"email\": \"Rahul@gmail.com\"}','::ffff:192.168.3.205','2026-06-24 17:07:24'),(4,21,'login_failed','users',21,'{\"email\": \"rahul@gmail.com\"}','::ffff:192.168.3.205','2026-06-24 17:07:48'),(5,21,'login','users',21,NULL,'::ffff:192.168.3.205','2026-06-24 17:07:57'),(6,1,'create_user','users',22,'{\"role\": \"employee\", \"email\": \"RahulAgent@gmail.com\"}','::ffff:192.168.3.205','2026-06-24 17:08:47'),(7,1,'create_user','users',23,'{\"role\": \"employee\", \"email\": \"DeepakAgent@gmail.com\"}','::ffff:192.168.3.205','2026-06-24 17:09:19'),(8,1,'create_group','groups',1,'{\"name\": \"RahulGroup\", \"tlIds\": [21], \"agentIds\": [22]}','::ffff:192.168.3.205','2026-06-24 17:10:02'),(9,1,'create_gateway','gsm_gateways',1,'{\"ip\": \"192.168.0.101\", \"name\": \"Dinstar-47\", \"port\": 5060}','::ffff:192.168.3.205','2026-06-24 17:10:45'),(10,1,'create_data_table','data_tables',1,'{\"name\": \"CSV baja\", \"columns\": [\"phone\", \"Proposal No\", \"Location,State\", \"Product\", \"EMI Amount\", \"Current Bucket\"]}','::ffff:192.168.3.205','2026-06-24 17:15:12'),(11,1,'create_group','groups',2,'{\"name\": \"Deepak group\", \"tlIds\": [20], \"agentIds\": [23]}','::ffff:192.168.3.205','2026-06-24 17:15:41'),(12,1,'create_campaign','campaigns',1,'{\"name\": \"RahulCampManual\", \"gatewayIds\": [1], \"dialer_type\": \"manual\"}','::ffff:192.168.3.205','2026-06-24 17:16:27'),(13,1,'create_campaign','campaigns',2,'{\"name\": \"RahulCampPredict\", \"gatewayIds\": [1], \"dialer_type\": \"predictive\"}','::ffff:192.168.3.205','2026-06-24 17:17:20'),(14,1,'create_campaign','campaigns',3,'{\"name\": \"DeepakCampManul\", \"gatewayIds\": [1], \"dialer_type\": \"manual\"}','::ffff:192.168.3.205','2026-06-24 17:17:49'),(15,1,'create_campaign','campaigns',4,'{\"name\": \"DeepakCampPredict\", \"gatewayIds\": [1], \"dialer_type\": \"predictive\"}','::ffff:192.168.3.205','2026-06-24 17:18:20'),(16,21,'upload_contacts','campaigns',2,'{\"by\": \"tl\", \"imported\": 2}','::ffff:192.168.3.205','2026-06-24 17:19:05'),(17,22,'login','users',22,NULL,'::ffff:192.168.3.205','2026-06-24 17:20:37'),(18,22,'login','users',22,NULL,'::1','2026-06-24 17:30:52'),(19,1,'login','users',1,NULL,'::ffff:192.168.3.205','2026-06-24 17:43:44'),(20,1,'create_gateway','gsm_gateways',2,'{\"ip\": \"192.168.0.247\", \"name\": \"WORK\", \"port\": 5060}','::ffff:192.168.3.205','2026-06-24 17:49:42'),(21,1,'update_campaign','campaigns',4,NULL,'::ffff:192.168.3.205','2026-06-24 17:49:50'),(22,1,'update_campaign','campaigns',3,NULL,'::ffff:192.168.3.205','2026-06-24 17:50:23'),(23,1,'update_campaign','campaigns',2,NULL,'::ffff:192.168.3.205','2026-06-24 17:50:38'),(24,1,'update_campaign','campaigns',1,NULL,'::ffff:192.168.3.205','2026-06-24 17:50:44'),(25,1,'update_campaign','campaigns',1,NULL,'::ffff:192.168.3.205','2026-06-24 17:57:44'),(26,1,'update_campaign','campaigns',2,NULL,'::ffff:192.168.3.205','2026-06-24 17:58:49'),(27,1,'upload_contacts','campaigns',2,'{\"imported\": 2}','::ffff:192.168.3.205','2026-06-24 17:59:47'),(28,1,'delete_gateway','gsm_gateways',1,NULL,'::ffff:192.168.3.205','2026-06-24 18:00:58'),(29,1,'delete_gateway','gsm_gateways',2,NULL,'::ffff:192.168.3.205','2026-06-24 18:01:03'),(30,22,'login','users',22,NULL,'::ffff:192.168.3.205','2026-06-24 18:02:40'),(31,1,'create_gateway','gsm_gateways',3,'{\"ip\": \"192.168.0.247\", \"name\": \"dinstar\", \"port\": 5060}','::ffff:192.168.3.205','2026-06-24 18:08:14'),(32,1,'update_campaign','campaigns',1,NULL,'::ffff:192.168.3.205','2026-06-24 18:12:07'),(33,1,'update_campaign','campaigns',1,NULL,'::ffff:192.168.3.205','2026-06-24 18:28:55'),(34,22,'login','users',22,NULL,'::1','2026-06-24 18:32:53'),(35,1,'update_campaign','campaigns',4,NULL,'::ffff:192.168.3.205','2026-06-24 21:24:07'),(36,1,'update_campaign','campaigns',3,NULL,'::ffff:192.168.3.205','2026-06-24 21:24:13'),(37,23,'login','users',23,NULL,'::ffff:192.168.3.205','2026-06-24 21:24:53'),(38,1,'update_campaign','campaigns',3,NULL,'::ffff:192.168.3.205','2026-06-24 21:44:31'),(39,1,'login','users',1,NULL,'::1','2026-06-24 21:46:08'),(40,1,'upload_contacts','campaigns',4,'{\"imported\": 2}','::1','2026-06-24 21:48:11'),(41,1,'create_gateway','gsm_gateways',4,'{\"ip\": \"192.168.0.00\", \"name\": \"fake to check\", \"port\": 5060}','::1','2026-06-24 21:53:14'),(42,1,'update_campaign','campaigns',3,NULL,'::1','2026-06-24 21:53:40'),(43,1,'update_campaign','campaigns',1,NULL,'::1','2026-06-24 21:54:19'),(44,1,'update_campaign','campaigns',1,NULL,'::1','2026-06-24 21:54:45'),(45,1,'update_campaign','campaigns',1,NULL,'::1','2026-06-24 21:54:57'),(46,1,'update_campaign','campaigns',1,NULL,'::1','2026-06-24 21:55:09'),(47,1,'update_campaign','campaigns',1,NULL,'::1','2026-06-24 21:55:36'),(48,1,'login','users',1,NULL,'::ffff:192.168.3.205','2026-06-24 22:00:12'),(49,22,'login','users',22,NULL,'::ffff:192.168.3.205','2026-06-24 22:03:53'),(50,1,'update_campaign','campaigns',1,NULL,'::ffff:192.168.3.205','2026-06-24 22:04:12'),(51,1,'update_campaign','campaigns',1,NULL,'::ffff:192.168.3.205','2026-06-24 22:04:24'),(52,1,'create_user','users',24,'{\"role\": \"employee\", \"email\": \"RahulAgent2@gmail.com\"}','::ffff:192.168.3.205','2026-06-24 22:05:42'),(53,24,'login','users',24,NULL,'::ffff:192.168.3.205','2026-06-24 22:05:54'),(54,1,'update_group','groups',1,'{\"name\": \"RahulGroup\", \"tlIds\": [21], \"agentIds\": [22, 24], \"description\": \"This is RahulGroup\"}','::ffff:192.168.3.205','2026-06-24 22:06:18'),(55,1,'upload_contacts','campaigns',2,'{\"imported\": 2}','::ffff:192.168.3.205','2026-06-24 22:07:01'),(56,1,'upload_contacts','campaigns',2,'{\"imported\": 2}','::ffff:192.168.3.205','2026-06-24 22:09:16'),(57,24,'login','users',24,NULL,'::1','2026-06-24 22:11:47'),(58,1,'upload_contacts','campaigns',2,'{\"imported\": 2}','::1','2026-06-24 22:12:38'),(59,1,'upload_contacts','campaigns',2,'{\"imported\": 2}','::1','2026-06-24 23:13:45'),(60,1,'login','users',1,NULL,'::1','2026-06-26 14:51:49'),(61,1,'update_campaign','campaigns',4,NULL,'::1','2026-06-26 14:52:52'),(62,1,'update_campaign','campaigns',4,NULL,'::1','2026-06-26 14:52:52'),(63,23,'login','users',23,NULL,'::1','2026-06-26 14:53:35'),(64,1,'create_user','users',25,'{\"role\": \"employee\", \"email\": \"DeepakAgent2@gmail.com\"}','::1','2026-06-26 14:55:09'),(65,1,'update_group','groups',2,'{\"name\": \"Deepak group\", \"tlIds\": [20], \"agentIds\": [23, 25], \"description\": \"Deepak group\"}','::1','2026-06-26 14:55:25'),(66,25,'login','users',25,NULL,'::1','2026-06-26 14:56:31'),(67,1,'update_campaign','campaigns',4,NULL,'::1','2026-06-26 14:57:13'),(68,1,'update_campaign','campaigns',3,NULL,'::1','2026-06-26 14:57:18'),(69,1,'upload_contacts','campaigns',4,'{\"imported\": 2}','::1','2026-06-26 14:57:47'),(70,1,'upload_contacts','campaigns',4,'{\"imported\": 4}','::1','2026-06-26 15:31:08'),(71,1,'login','users',1,NULL,'::ffff:192.168.3.205','2026-06-27 14:15:54'),(72,20,'login','users',20,NULL,'::ffff:192.168.3.205','2026-06-27 16:02:57'),(73,NULL,'login_failed','users',NULL,'{\"email\": \"DeeoakAgent@gmail.com\"}','::ffff:192.168.3.205','2026-06-27 16:05:31'),(74,23,'login','users',23,NULL,'::ffff:192.168.3.205','2026-06-27 16:05:43'),(75,1,'login','users',1,NULL,'::ffff:192.168.3.205','2026-06-27 16:11:04'),(76,23,'login','users',23,NULL,'::ffff:192.168.3.205','2026-06-27 18:35:41'),(77,23,'login','users',23,NULL,'::1','2026-06-27 18:40:49'),(78,1,'login','users',1,NULL,'::ffff:192.168.3.205','2026-06-27 20:22:55'),(79,1,'upload_contacts','campaigns',4,'{\"imported\": 1}','::ffff:192.168.3.205','2026-06-27 20:23:27'),(80,1,'upload_contacts','campaigns',3,'{\"imported\": 1}','::ffff:192.168.3.205','2026-06-27 20:25:42'),(81,23,'login','users',23,NULL,'::ffff:192.168.3.205','2026-06-27 20:28:34'),(82,23,'login','users',23,NULL,'::1','2026-06-27 20:31:36'),(83,1,'login','users',1,NULL,'::1','2026-06-27 20:31:48'),(84,1,'upload_contacts','campaigns',4,'{\"imported\": 1}','::1','2026-06-27 23:38:07'),(85,22,'login','users',22,NULL,'::ffff:192.168.3.205','2026-06-28 00:20:20'),(86,22,'logout','users',22,NULL,'::ffff:192.168.3.205','2026-06-28 00:22:13'),(87,1,'login','users',1,NULL,'::ffff:100.75.171.84','2026-06-28 02:20:03'),(88,1,'logout','users',1,NULL,'::ffff:100.75.171.84','2026-06-28 02:23:37'),(89,23,'login','users',23,NULL,'::ffff:100.75.171.84','2026-06-28 02:24:07'),(90,23,'login','users',23,NULL,'::ffff:100.75.171.84','2026-06-28 02:29:50'),(91,1,'login','users',1,NULL,'::ffff:192.168.2.2','2026-07-04 14:51:41'),(92,1,'update_campaign','campaigns',3,NULL,'::ffff:192.168.3.205','2026-07-04 14:52:32'),(93,23,'login','users',23,NULL,'::ffff:192.168.2.2','2026-07-04 15:50:28'),(94,1,'upload_contacts','campaigns',4,'{\"imported\": 1}','::ffff:192.168.2.2','2026-07-04 15:53:01'),(95,1,'upload_contacts','campaigns',4,'{\"imported\": 1}','::ffff:192.168.2.27','2026-07-04 15:59:18'),(96,1,'create_data_table','data_tables',2,'{\"name\": \"10\", \"columns\": [\"new10\"]}','::ffff:192.168.2.27','2026-07-04 16:07:05'),(97,1,'login','users',1,NULL,'::ffff:192.168.3.205','2026-07-07 12:58:20'),(98,23,'login','users',23,NULL,'::ffff:192.168.3.205','2026-07-07 13:00:04'),(99,23,'login','users',23,NULL,'::ffff:192.168.3.205','2026-07-07 13:09:17'),(100,1,'login','users',1,NULL,'::ffff:100.75.171.84','2026-07-08 01:03:10'),(101,1,'login','users',1,NULL,'::ffff:100.75.171.84','2026-07-11 14:51:21'),(102,1,'logout','users',1,NULL,'::ffff:100.75.171.84','2026-07-11 14:51:48'),(103,23,'login','users',23,NULL,'::ffff:100.75.171.84','2026-07-11 14:52:08'),(104,23,'login','users',23,NULL,'::ffff:100.75.171.84','2026-07-11 14:54:43'),(105,1,'login','users',1,NULL,'::ffff:192.168.3.205','2026-07-23 16:27:52'),(106,1,'login','users',1,NULL,'::ffff:192.168.3.205','2026-07-25 01:17:19'),(107,1,'login','users',1,NULL,'::ffff:192.168.3.205','2026-07-25 02:32:15'),(108,1,'login','users',1,NULL,'::1','2026-07-25 02:47:29'),(109,1,'login','users',1,NULL,'::1','2026-07-25 13:26:41'),(110,1,'update_list','lists',3,'{\"active\": \"N\", \"previousCampaignId\": 3}','::1','2026-07-25 14:04:29'),(111,1,'update_list','lists',3,'{\"active\": \"N\", \"previousCampaignId\": 3}','::1','2026-07-25 14:04:31'),(112,1,'login','users',1,NULL,'::ffff:192.168.3.205','2026-07-25 14:11:03'),(113,1,'update_list','lists',3,'{\"active\": \"Y\", \"previousCampaignId\": 3}','::1','2026-07-25 14:16:03'),(114,1,'delete_list','lists',1,'{\"name\": \"Default List\", \"campaignId\": 1}','::1','2026-07-25 14:48:07'),(115,1,'create_campaign','campaigns',9,'{\"name\": \"newcamp\", \"gatewayIds\": [3], \"dialer_type\": \"predictive\"}','::1','2026-07-25 14:49:11'),(116,1,'update_campaign','campaigns',9,NULL,'::1','2026-07-25 14:49:42'),(117,1,'create_list','lists',9,'{\"name\": \"newtestist2\", \"active\": \"N\", \"fields\": [\"new\"], \"campaignId\": 9}','::1','2026-07-25 14:51:25'),(118,1,'update_list','lists',9,'{\"active\": \"Y\", \"previousCampaignId\": 9}','::1','2026-07-25 14:52:12'),(119,1,'upload_contacts','lists',9,'{\"dupMode\": \"none\", \"imported\": 1, \"campaignId\": 9, \"skippedDuplicates\": 0}','::1','2026-07-25 14:52:45'),(120,23,'login','users',23,NULL,'::1','2026-07-25 14:54:20'),(121,23,'login','users',23,NULL,'::ffff:192.168.3.205','2026-07-25 15:07:51'),(122,1,'update_campaign','campaigns',9,NULL,'::ffff:192.168.3.205','2026-07-25 16:44:04'),(123,1,'update_campaign','campaigns',9,NULL,'::ffff:192.168.3.205','2026-07-25 16:44:08'),(124,1,'update_campaign','campaigns',9,NULL,'::ffff:192.168.3.205','2026-07-25 16:44:22'),(125,1,'login','users',1,NULL,'::1','2026-07-25 17:40:25'),(126,1,'upload_contacts','lists',8,'{\"dupMode\": \"none\", \"imported\": 1, \"newFields\": [\"phone_number\", \"Proposal No\", \"Location\", \"EMI Amount\", \"Current Bucket\", \"EMI OS\", \"LPP Charges\", \"BCC Charges\", \"REPO Charges\", \"Other Due Charges\", \"Total Due\", \"Residence Address\", \"Residence Pin Code\", \"Residence Phone1\", \"Reference 1 Name\", \"Reference 1 Phone1\", \"Reference 2 Name\", \"Reference 2 Phone1\", \"Registration Number\", \"Engine No\", \"Asset Desc\", \"Last Payment Date\", \"NET MAT DATE\", \"Supplier Id\", \"Process\", \"MONTH\"], \"campaignId\": 9, \"skippedDuplicates\": 0}','::1','2026-07-25 17:43:09'),(127,1,'login','users',1,NULL,'::1','2026-07-31 22:03:49'),(128,23,'login','users',23,NULL,'::1','2026-07-31 22:04:45'),(129,23,'login','users',23,NULL,'::ffff:192.168.3.205','2026-07-31 22:16:49'),(130,1,'login','users',1,NULL,'::1','2026-07-31 22:36:22'),(131,1,'delete_list','lists',4,'{\"name\": \"Default List\", \"campaignId\": 4, \"deletedLeads\": 12}','::1','2026-07-31 22:36:46'),(132,1,'delete_list','lists',8,'{\"name\": \"Default List\", \"campaignId\": 9, \"deletedLeads\": 1}','::1','2026-07-31 22:36:52'),(133,1,'delete_list','lists',9,'{\"name\": \"newtestist2\", \"campaignId\": 9, \"deletedLeads\": 1}','::1','2026-07-31 22:36:56'),(134,1,'delete_list','lists',2,'{\"name\": \"Default List\", \"campaignId\": 2, \"deletedLeads\": 12}','::1','2026-07-31 22:37:00'),(135,1,'create_list','lists',10,'{\"name\": \"Newtestforlist\", \"active\": \"Y\", \"fields\": [\"Customer Name\", \"Mobile No\", \"Ref - No\", \"Address\", \"City\", \"State\", \"POST CODE\", \"Product\", \"Product Dis\", \"REG NO\", \"DPD\", \"LMPD\", \"LPC\", \"CBC\", \"Tenure\", \"Dealer Name\", \"Process Name\", \"Ref - 1 Name\", \"Ref_2 Name\", \"Ref_2 No\", \"M_Data\", \"Other\", \"Toss\", \"Title (Priority Data)\", \"checkfield\"], \"campaignId\": 4}','::1','2026-07-31 22:49:55'),(136,1,'upload_contacts','lists',10,'{\"dupMode\": \"none\", \"imported\": 1, \"campaignId\": 4, \"ignoredColumns\": [], \"skippedDuplicates\": 0}','::1','2026-07-31 22:56:09'),(137,1,'update_campaign','campaigns',4,NULL,'::1','2026-07-31 23:12:02'),(138,1,'update_campaign','campaigns',4,NULL,'::1','2026-08-01 01:06:15'),(139,1,'update_campaign','campaigns',4,NULL,'::1','2026-08-01 02:32:21'),(140,1,'update_campaign','campaigns',4,NULL,'::1','2026-08-01 02:33:38'),(141,1,'logout','users',1,NULL,'::1','2026-08-01 02:46:29'),(142,23,'logout','users',23,NULL,'::1','2026-08-01 02:46:36'),(143,23,'logout','users',23,NULL,'::1','2026-08-01 02:46:40'),(144,22,'login','users',22,NULL,'::1','2026-08-01 02:47:05'),(145,1,'update_list','lists',10,'{\"name\": \"Newtestforlist\", \"fields\": [\"Customer Name\", \"Mobile No\", \"Ref - No\", \"Address\", \"City\", \"State\", \"POST CODE\", \"Product\", \"Product Dis\", \"REG NO\", \"DPD\", \"LMPD\", \"LPC\", \"CBC\", \"Tenure\", \"Dealer Name\", \"Process Name\", \"Ref - 1 Name\", \"Ref_2 Name\", \"Ref_2 No\", \"M_Data\", \"Other\", \"Toss\", \"Title (Priority Data)\", \"checkfield\"], \"campaign_id\": 2, \"description\": \"Newtestforlist\", \"previousCampaignId\": 4}','::1','2026-08-01 02:47:55'),(146,1,'update_campaign','campaigns',2,NULL,'::1','2026-08-01 02:48:53'),(147,1,'reset_list','lists',10,'{\"name\": \"Newtestforlist\", \"resetCount\": 1, \"dialableAfter\": 1, \"pendingRetries\": 0}','::1','2026-08-01 03:02:49'),(148,1,'update_campaign','campaigns',2,NULL,'::1','2026-08-01 03:05:31'),(149,1,'update_campaign','campaigns',2,NULL,'::1','2026-08-01 03:07:24'),(150,1,'update_campaign','campaigns',2,NULL,'::1','2026-08-01 03:08:08'),(151,1,'update_campaign','campaigns',2,NULL,'::1','2026-08-01 03:08:39'),(152,1,'reset_list','lists',10,'{\"name\": \"Newtestforlist\", \"resetCount\": 1, \"dialableAfter\": 1, \"pendingRetries\": 1}','::1','2026-08-01 03:09:51'),(153,1,'reset_list','lists',10,'{\"name\": \"Newtestforlist\", \"resetCount\": 1, \"dialableAfter\": 1, \"pendingRetries\": 1}','::1','2026-08-01 03:10:29'),(154,1,'update_campaign','campaigns',2,NULL,'::1','2026-08-01 03:10:33'),(155,1,'update_campaign','campaigns',2,NULL,'::1','2026-08-01 03:11:42'),(156,1,'login','users',1,NULL,'::1','2026-08-01 15:26:18'),(157,23,'login','users',23,NULL,'::1','2026-08-01 15:27:39'),(158,1,'login','users',1,NULL,'::ffff:192.168.3.205','2026-08-02 12:15:53'),(159,22,'login','users',22,NULL,'::ffff:192.168.3.205','2026-08-02 12:16:33'),(160,1,'logout','users',1,NULL,'::ffff:192.168.3.205','2026-08-02 12:44:48'),(161,1,'login','users',1,NULL,'::ffff:192.168.3.205','2026-08-02 12:44:51'),(162,1,'update_campaign','campaigns',2,NULL,'::ffff:192.168.3.205','2026-08-02 12:45:29'),(163,1,'delete_campaign','campaigns',9,'{\"name\": \"newcamp\", \"deletedLeads\": 0, \"deletedLists\": 0}','::ffff:192.168.3.205','2026-08-02 12:51:04'),(164,1,'update_list','lists',10,'{\"name\": \"Newtestforlist\", \"fields\": [\"Customer Name\", \"Mobile No\", \"Ref - No\", \"Address\", \"City\", \"State\", \"POST CODE\", \"Product\", \"Product Dis\", \"REG NO\", \"DPD\", \"LMPD\", \"LPC\", \"CBC\", \"Tenure\", \"Dealer Name\", \"Process Name\", \"Ref - 1 Name\", \"Ref_2 Name\", \"Ref_2 No\", \"M_Data\", \"Other\", \"Toss\", \"Title (Priority Data)\", \"checkfield\"], \"campaign_id\": 4, \"description\": \"Newtestforlist\", \"previousCampaignId\": 2}','::ffff:192.168.3.205','2026-08-02 13:00:05'),(165,1,'update_campaign','campaigns',4,NULL,'::ffff:192.168.3.205','2026-08-02 13:06:12'),(166,1,'update_campaign','campaigns',4,NULL,'::ffff:192.168.3.205','2026-08-02 13:12:51'),(167,1,'update_campaign','campaigns',4,NULL,'::ffff:192.168.3.205','2026-08-02 13:15:07'),(168,1,'update_list','lists',10,'{\"name\": \"Newtestforlist\", \"fields\": [\"Customer Name\", \"Mobile No\", \"Ref - No\", \"Address\", \"City\", \"State\", \"POST CODE\", \"Product\", \"Product Dis\", \"REG NO\", \"DPD\", \"LMPD\", \"LPC\", \"CBC\", \"Tenure\", \"Dealer Name\", \"Process Name\", \"Ref - 1 Name\", \"Ref_2 Name\", \"Ref_2 No\", \"M_Data\", \"Other\", \"Toss\", \"Title (Priority Data)\", \"checkfield\"], \"campaign_id\": 3, \"description\": \"Newtestforlist\", \"previousCampaignId\": 4}','::ffff:192.168.3.205','2026-08-02 13:41:05'),(169,1,'update_campaign','campaigns',3,NULL,'::ffff:192.168.3.205','2026-08-02 13:41:40'),(170,1,'login','users',1,NULL,'::1','2026-08-02 14:16:40'),(171,22,'login','users',22,NULL,'::1','2026-08-02 14:17:51'),(172,1,'update_list','lists',10,'{\"name\": \"Newtestforlist\", \"fields\": [\"Customer Name\", \"Mobile No\", \"Ref - No\", \"Address\", \"City\", \"State\", \"POST CODE\", \"Product\", \"Product Dis\", \"REG NO\", \"DPD\", \"LMPD\", \"LPC\", \"CBC\", \"Tenure\", \"Dealer Name\", \"Process Name\", \"Ref - 1 Name\", \"Ref_2 Name\", \"Ref_2 No\", \"M_Data\", \"Other\", \"Toss\", \"Title (Priority Data)\", \"checkfield\"], \"campaign_id\": 1, \"description\": \"Newtestforlist\", \"previousCampaignId\": 3}','::1','2026-08-02 14:19:35'),(173,1,'update_campaign','campaigns',1,NULL,'::1','2026-08-02 14:22:28'),(174,1,'update_list','lists',10,'{\"name\": \"Newtestforlist\", \"fields\": [\"Customer Name\", \"Mobile No\", \"Ref - No\", \"Address\", \"City\", \"State\", \"POST CODE\", \"Product\", \"Product Dis\", \"REG NO\", \"DPD\", \"LMPD\", \"LPC\", \"CBC\", \"Tenure\", \"Dealer Name\", \"Process Name\", \"Ref - 1 Name\", \"Ref_2 Name\", \"Ref_2 No\", \"M_Data\", \"Other\", \"Toss\", \"Title (Priority Data)\", \"checkfield\"], \"campaign_id\": 2, \"description\": \"Newtestforlist\", \"previousCampaignId\": 1}','::1','2026-08-02 14:44:36'),(175,1,'update_campaign','campaigns',2,NULL,'::1','2026-08-02 14:45:35'),(176,1,'update_campaign','campaigns',2,NULL,'::1','2026-08-02 14:48:15'),(177,1,'update_campaign','campaigns',2,NULL,'::1','2026-08-02 14:49:44'),(178,1,'update_list','lists',3,'{\"name\": \"Default List\", \"fields\": [\"Customer Name\", \"Mobile No\", \"Ref - No\", \"Address\", \"City\", \"State\", \"POST CODE\", \"Product\", \"Product Dis\", \"REG NO\", \"DPD\", \"LMPD\", \"LPC\", \"CBC\", \"Tenure\", \"Dealer Name\", \"Process Name\", \"Ref - 1 Name\", \"Ref_2 Name\", \"Ref_2 No\", \"M_Data\", \"Other\", \"Toss\", \"Title (Priority Data)\"], \"campaign_id\": 1, \"description\": \"Auto-created by the lists migration (pre-lists leads)\", \"previousCampaignId\": 3}','::ffff:192.168.3.205','2026-08-02 15:01:08'),(179,1,'update_campaign','campaigns',1,NULL,'::ffff:192.168.3.205','2026-08-02 15:09:28'),(180,1,'update_list','lists',3,'{\"name\": \"Default List\", \"fields\": [\"Customer Name\", \"Mobile No\", \"Ref - No\", \"Address\", \"City\", \"State\", \"POST CODE\", \"Product\", \"Product Dis\", \"REG NO\", \"DPD\", \"LMPD\", \"LPC\", \"CBC\", \"Tenure\", \"Dealer Name\", \"Process Name\", \"Ref - 1 Name\", \"Ref_2 Name\", \"Ref_2 No\", \"M_Data\", \"Other\", \"Toss\", \"Title (Priority Data)\"], \"campaign_id\": 1, \"description\": \"Auto-created\", \"previousCampaignId\": 1}','::1','2026-08-02 15:35:17'),(181,1,'create_list','lists',25,'{\"name\": \"newmanual\", \"active\": \"Y\", \"fields\": [\"Customer Name\", \"Mobile No\", \"Ref - No\", \"Address\", \"City\", \"State\", \"POST CODE\", \"Product\", \"Product Dis\", \"REG NO\", \"DPD\", \"LMPD\", \"LPC\", \"CBC\", \"Tenure\", \"Dealer Name\", \"Process Name\", \"Ref - 1 Name\", \"Ref_2 Name\", \"Ref_2 No\", \"M_Data\", \"Other\", \"Toss\", \"Title (Priority Data)\", \"newww\"], \"campaignId\": 1}','::1','2026-08-02 16:07:31'),(182,1,'upload_contacts','lists',25,'{\"dupMode\": \"none\", \"imported\": 1, \"campaignId\": 1, \"ignoredColumns\": [], \"skippedDuplicates\": 0}','::1','2026-08-02 16:07:57'),(183,1,'reset_list','lists',25,'{\"name\": \"newmanual\", \"resetCount\": 0, \"dialableAfter\": 1, \"pendingRetries\": 0}','::ffff:192.168.3.205','2026-08-02 16:15:37'),(184,1,'delete_list','lists',25,'{\"name\": \"newmanual\", \"campaignId\": 1, \"deletedLeads\": 1}','::ffff:192.168.3.205','2026-08-02 16:15:50'),(185,1,'update_list','lists',3,'{\"name\": \"Default List\", \"fields\": [\"Customer Name\", \"Mobile No\", \"Ref - No\", \"Address\", \"City\", \"State\", \"POST CODE\", \"Product\", \"Product Dis\", \"REG NO\", \"DPD\", \"LMPD\", \"LPC\", \"CBC\", \"Tenure\", \"Dealer Name\", \"Process Name\", \"Ref - 1 Name\", \"Ref_2 Name\", \"Ref_2 No\", \"M_Data\", \"Other\", \"Toss\", \"Title (Priority Data)\"], \"campaign_id\": 3, \"description\": \"Auto-created\", \"previousCampaignId\": 1}','::ffff:192.168.3.205','2026-08-02 16:16:06'),(186,1,'create_list','lists',26,'{\"name\": \"manualRahul\", \"active\": \"Y\", \"fields\": [\"Customer Name\", \"Mobile No\", \"Ref - No\", \"Address\", \"City\", \"State\", \"POST CODE\", \"Product\", \"Product Dis\", \"REG NO\", \"DPD\", \"LMPD\", \"LPC\", \"CBC\", \"Tenure\", \"Dealer Name\", \"Process Name\", \"Ref - 1 Name\", \"Ref_2 Name\", \"Ref_2 No\", \"M_Data\", \"Other\", \"Toss\", \"Title (Priority Data)\", \"newwwww\"], \"campaignId\": 1}','::ffff:192.168.3.205','2026-08-02 16:16:51'),(187,1,'upload_contacts','lists',26,'{\"dupMode\": \"none\", \"imported\": 1, \"campaignId\": 1, \"ignoredColumns\": [], \"skippedDuplicates\": 0}','::ffff:192.168.3.205','2026-08-02 16:17:18'),(188,22,'logout','users',22,NULL,'::1','2026-08-02 16:18:48'),(189,1,'delete_list','lists',26,'{\"name\": \"manualRahul\", \"campaignId\": 1, \"deletedLeads\": 1}','::1','2026-08-02 16:18:58'),(190,22,'login','users',22,NULL,'::1','2026-08-02 16:19:35'),(191,1,'create_list','lists',27,'{\"name\": \"newmanual\", \"active\": \"Y\", \"fields\": [\"Customer Name\", \"Mobile No\", \"Ref - No\", \"Address\", \"City\", \"State\", \"POST CODE\", \"Product\", \"Product Dis\", \"REG NO\", \"DPD\", \"LMPD\", \"LPC\", \"CBC\", \"Tenure\", \"Dealer Name\", \"Process Name\", \"Ref - 1 Name\", \"Ref_2 Name\", \"Ref_2 No\", \"M_Data\", \"Other\", \"Toss\", \"Title (Priority Data)\", \"neww\"], \"campaignId\": 1}','::1','2026-08-02 16:20:31'),(192,1,'upload_contacts','lists',27,'{\"dupMode\": \"none\", \"imported\": 1, \"campaignId\": 1, \"ignoredColumns\": [], \"skippedDuplicates\": 0}','::1','2026-08-02 16:20:57'),(193,1,'reset_list','lists',27,'{\"name\": \"newmanual\", \"resetCount\": 0, \"dialableAfter\": 0, \"pendingRetries\": 0}','::1','2026-08-02 16:21:33'),(194,1,'update_campaign','campaigns',1,NULL,'::1','2026-08-02 16:21:39'),(195,1,'reset_list','lists',27,'{\"name\": \"newmanual\", \"resetCount\": 0, \"dialableAfter\": 0, \"pendingRetries\": 0}','::1','2026-08-02 16:21:50'),(196,1,'update_list','lists',10,'{\"name\": \"Newtestforlist\", \"fields\": [\"Customer Name\", \"Mobile No\", \"Ref - No\", \"Address\", \"City\", \"State\", \"POST CODE\", \"Product\", \"Product Dis\", \"REG NO\", \"DPD\", \"LMPD\", \"LPC\", \"CBC\", \"Tenure\", \"Dealer Name\", \"Process Name\", \"Ref - 1 Name\", \"Ref_2 Name\", \"Ref_2 No\", \"M_Data\", \"Other\", \"Toss\", \"Title (Priority Data)\", \"checkfield\"], \"campaign_id\": 4, \"description\": \"Newtestforlist\", \"previousCampaignId\": 2}','::ffff:192.168.3.205','2026-08-02 16:24:46'),(197,1,'update_list','lists',27,'{\"name\": \"newmanual\", \"fields\": [\"Customer Name\", \"Mobile No\", \"Ref - No\", \"Address\", \"City\", \"State\", \"POST CODE\", \"Product\", \"Product Dis\", \"REG NO\", \"DPD\", \"LMPD\", \"LPC\", \"CBC\", \"Tenure\", \"Dealer Name\", \"Process Name\", \"Ref - 1 Name\", \"Ref_2 Name\", \"Ref_2 No\", \"M_Data\", \"Other\", \"Toss\", \"Title (Priority Data)\", \"neww\"], \"campaign_id\": 2, \"description\": \"newmanual\", \"previousCampaignId\": 1}','::ffff:192.168.3.205','2026-08-02 16:25:02'),(198,1,'update_list','lists',27,'{\"name\": \"newmanual\", \"fields\": [\"Customer Name\", \"Mobile No\", \"Ref - No\", \"Address\", \"City\", \"State\", \"POST CODE\", \"Product\", \"Product Dis\", \"REG NO\", \"DPD\", \"LMPD\", \"LPC\", \"CBC\", \"Tenure\", \"Dealer Name\", \"Process Name\", \"Ref - 1 Name\", \"Ref_2 Name\", \"Ref_2 No\", \"M_Data\", \"Other\", \"Toss\", \"Title (Priority Data)\", \"neww\"], \"campaign_id\": 1, \"description\": \"newmanual\", \"previousCampaignId\": 2}','::ffff:192.168.3.205','2026-08-02 16:25:25'),(199,1,'update_list','lists',27,'{\"name\": \"newmanual\", \"fields\": [\"Customer Name\", \"Mobile No\", \"Ref - No\", \"Address\", \"City\", \"State\", \"POST CODE\", \"Product\", \"Product Dis\", \"REG NO\", \"DPD\", \"LMPD\", \"LPC\", \"CBC\", \"Tenure\", \"Dealer Name\", \"Process Name\", \"Ref - 1 Name\", \"Ref_2 Name\", \"Ref_2 No\", \"M_Data\", \"Other\", \"Toss\", \"Title (Priority Data)\", \"neww\"], \"campaign_id\": 2, \"description\": \"newmanual\", \"previousCampaignId\": 1}','::ffff:192.168.3.205','2026-08-02 16:27:32'),(200,1,'create_list','lists',28,'{\"name\": \"newwwmanual\", \"active\": \"Y\", \"fields\": [\"Customer Name\", \"Mobile No\", \"Ref - No\", \"Address\", \"City\", \"State\", \"POST CODE\", \"Product\", \"Product Dis\", \"REG NO\", \"DPD\", \"LMPD\", \"LPC\", \"CBC\", \"Tenure\", \"Dealer Name\", \"Process Name\", \"Ref - 1 Name\", \"Ref_2 Name\", \"Ref_2 No\", \"M_Data\", \"Other\", \"Toss\", \"Title (Priority Data)\", \"newwww\"], \"campaignId\": 1}','::ffff:192.168.3.205','2026-08-02 16:28:12'),(201,1,'upload_contacts','lists',28,'{\"dupMode\": \"none\", \"imported\": 1, \"campaignId\": 1, \"ignoredColumns\": [], \"skippedDuplicates\": 0}','::ffff:192.168.3.205','2026-08-02 16:28:30'),(202,1,'update_campaign','campaigns',1,NULL,'::ffff:192.168.3.205','2026-08-02 16:29:01'),(203,1,'delete_list','lists',27,'{\"name\": \"newmanual\", \"campaignId\": 2, \"deletedLeads\": 1}','::1','2026-08-02 16:36:07'),(204,1,'create_list','lists',29,'{\"name\": \"test11\", \"active\": \"Y\", \"fields\": [\"Customer Name\", \"Mobile No\", \"Ref - No\", \"Address\", \"City\", \"State\", \"POST CODE\", \"Product\", \"Product Dis\", \"REG NO\", \"DPD\", \"LMPD\", \"LPC\", \"CBC\", \"Tenure\", \"Dealer Name\", \"Process Name\", \"Ref - 1 Name\", \"Ref_2 Name\", \"Ref_2 No\", \"M_Data\", \"Other\", \"Toss\", \"Title (Priority Data)\", \"testtt\"], \"campaignId\": 1}','::1','2026-08-02 16:36:49'),(205,1,'update_list','lists',28,'{\"name\": \"newwwmanual\", \"fields\": [\"Customer Name\", \"Mobile No\", \"Ref - No\", \"Address\", \"City\", \"State\", \"POST CODE\", \"Product\", \"Product Dis\", \"REG NO\", \"DPD\", \"LMPD\", \"LPC\", \"CBC\", \"Tenure\", \"Dealer Name\", \"Process Name\", \"Ref - 1 Name\", \"Ref_2 Name\", \"Ref_2 No\", \"M_Data\", \"Other\", \"Toss\", \"Title (Priority Data)\", \"newwww\"], \"campaign_id\": 2, \"description\": \"newwwmanual\", \"previousCampaignId\": 1}','::1','2026-08-02 16:37:37'),(206,1,'update_list','lists',28,'{\"name\": \"newwwmanual\", \"fields\": [\"Customer Name\", \"Mobile No\", \"Ref - No\", \"Address\", \"City\", \"State\", \"POST CODE\", \"Product\", \"Product Dis\", \"REG NO\", \"DPD\", \"LMPD\", \"LPC\", \"CBC\", \"Tenure\", \"Dealer Name\", \"Process Name\", \"Ref - 1 Name\", \"Ref_2 Name\", \"Ref_2 No\", \"M_Data\", \"Other\", \"Toss\", \"Title (Priority Data)\", \"newwww\"], \"campaign_id\": 1, \"description\": \"newwwmanual\", \"previousCampaignId\": 2}','::1','2026-08-02 16:37:44'),(207,1,'upload_contacts','lists',28,'{\"dupMode\": \"none\", \"imported\": 1, \"campaignId\": 1, \"ignoredColumns\": [], \"skippedDuplicates\": 0}','::1','2026-08-02 16:38:36'),(208,1,'update_list','lists',28,'{\"name\": \"newwwmanual\", \"fields\": [\"Customer Name\", \"Mobile No\", \"Ref - No\", \"Address\", \"City\", \"State\", \"POST CODE\", \"Product\", \"Product Dis\", \"REG NO\", \"DPD\", \"LMPD\", \"LPC\", \"CBC\", \"Tenure\", \"Dealer Name\", \"Process Name\", \"Ref - 1 Name\", \"Ref_2 Name\", \"Ref_2 No\", \"M_Data\", \"Other\", \"Toss\", \"Title (Priority Data)\", \"newwww\"], \"campaign_id\": 2, \"description\": \"newwwmanual\", \"previousCampaignId\": 1}','::1','2026-08-02 16:39:04'),(209,1,'upload_contacts','lists',29,'{\"dupMode\": \"none\", \"imported\": 1, \"campaignId\": 1, \"ignoredColumns\": [], \"skippedDuplicates\": 0}','::1','2026-08-02 16:39:26'),(210,1,'reset_list','lists',29,'{\"name\": \"test11\", \"resetCount\": 0, \"dialableAfter\": 1, \"pendingRetries\": 0}','::ffff:192.168.3.205','2026-08-02 16:48:26'),(211,1,'reset_list','lists',29,'{\"name\": \"test11\", \"resetCount\": 0, \"dialableAfter\": 0, \"pendingRetries\": 0}','::1','2026-08-02 16:50:16'),(212,1,'reset_list','lists',29,'{\"name\": \"test11\", \"resetCount\": 0, \"dialableAfter\": 0, \"pendingRetries\": 0}','::1','2026-08-02 17:33:01'),(213,1,'reset_list','lists',29,'{\"name\": \"test11\", \"resetCount\": 0, \"dialableAfter\": 0, \"pendingRetries\": 0}','::1','2026-08-02 17:33:10'),(214,1,'reset_list','lists',29,'{\"name\": \"test11\", \"resetCount\": 0, \"dialableAfter\": 0, \"pendingRetries\": 0}','::ffff:192.168.3.205','2026-08-02 17:33:19'),(215,NULL,'login_failed','users',NULL,'{\"email\": \"DeepakAgent@gamil.com\"}','::ffff:100.75.171.84','2026-08-02 21:11:01'),(216,NULL,'login_failed','users',NULL,'{\"email\": \"DeepakAgent@gamil.com\"}','::ffff:100.75.171.84','2026-08-02 21:11:06'),(217,NULL,'login_failed','users',NULL,'{\"email\": \"DeepakAgent@gamil.com\"}','::ffff:100.75.171.84','2026-08-02 21:11:14'),(218,1,'login','users',1,NULL,'::ffff:100.75.171.84','2026-08-02 21:11:19'),(219,1,'logout','users',1,NULL,'::ffff:100.75.171.84','2026-08-02 21:11:30'),(220,23,'login','users',23,NULL,'::ffff:100.75.171.84','2026-08-02 21:11:47'),(221,1,'login','users',1,NULL,'::ffff:192.168.2.2','2026-08-03 13:23:46'),(222,1,'update_list','lists',3,'{\"active\": \"N\", \"previousCampaignId\": 3}','::ffff:192.168.2.19','2026-08-03 13:31:44'),(223,1,'update_list','lists',3,'{\"active\": \"Y\", \"previousCampaignId\": 3}','::ffff:192.168.2.19','2026-08-03 13:31:47'),(224,1,'update_list','lists',10,'{\"name\": \"Newtestforlist\", \"fields\": [\"Customer Name\", \"Mobile No\", \"Ref - No\", \"Address\", \"City\", \"State\", \"POST CODE\", \"Product\", \"Product Dis\", \"REG NO\", \"DPD\", \"LMPD\", \"LPC\", \"CBC\", \"Tenure\", \"Dealer Name\", \"Process Name\", \"Ref - 1 Name\", \"Ref_2 Name\", \"Ref_2 No\", \"M_Data\", \"Other\", \"Toss\", \"Title (Priority Data)\", \"checkfield\"], \"campaign_id\": 2, \"description\": \"Newtestforlist\", \"previousCampaignId\": 4}','::ffff:192.168.2.19','2026-08-03 13:33:28'),(225,1,'update_campaign','campaigns',2,NULL,'::ffff:192.168.2.19','2026-08-03 13:33:50'),(226,1,'create_list','lists',31,'{\"name\": \"newtestforpredic\", \"active\": \"Y\", \"fields\": [\"Customer Name\", \"Mobile No\", \"Ref - No\", \"Address\", \"City\", \"State\", \"POST CODE\", \"Product\", \"Product Dis\", \"REG NO\", \"DPD\", \"LMPD\", \"LPC\", \"CBC\", \"Tenure\", \"Dealer Name\", \"Process Name\", \"Ref - 1 Name\", \"Ref_2 Name\", \"Ref_2 No\", \"M_Data\", \"Other\", \"Toss\", \"Title (Priority Data)\"], \"campaignId\": 4}','::ffff:192.168.2.19','2026-08-03 13:40:39'),(227,1,'upload_contacts','lists',31,'{\"dupMode\": \"none\", \"imported\": 1, \"campaignId\": 4, \"ignoredColumns\": [], \"skippedDuplicates\": 0}','::ffff:192.168.2.19','2026-08-03 13:41:06'),(228,1,'update_campaign','campaigns',4,NULL,'::ffff:192.168.2.19','2026-08-03 13:41:19'),(229,23,'login','users',23,NULL,'::ffff:192.168.2.19','2026-08-03 13:41:47'),(230,1,'reset_list','lists',31,'{\"name\": \"newtestforpredic\", \"resetCount\": 0, \"dialableAfter\": 0, \"pendingRetries\": 0}','::ffff:192.168.2.19','2026-08-03 13:42:32'),(231,1,'update_campaign','campaigns',4,NULL,'::ffff:192.168.3.205','2026-08-03 13:43:47'),(232,1,'reset_list','lists',3,'{\"name\": \"Default List\", \"resetCount\": 0, \"dialableAfter\": 0, \"pendingRetries\": 0}','::ffff:192.168.3.205','2026-08-03 13:43:55'),(233,1,'reset_list','lists',31,'{\"name\": \"newtestforpredic\", \"resetCount\": 1, \"dialableAfter\": 1, \"pendingRetries\": 1}','::ffff:192.168.3.205','2026-08-03 13:44:00'),(234,1,'create_list','lists',32,'{\"name\": \"newwww\", \"active\": \"Y\", \"fields\": [\"Customer Name\", \"Mobile No\", \"Ref - No\", \"Address\", \"City\", \"State\", \"POST CODE\", \"Product\", \"Product Dis\", \"REG NO\", \"DPD\", \"LMPD\", \"LPC\", \"CBC\", \"Tenure\", \"Dealer Name\", \"Process Name\", \"Ref - 1 Name\", \"Ref_2 Name\", \"Ref_2 No\", \"M_Data\", \"Other\", \"Toss\", \"Title (Priority Data)\"], \"campaignId\": 4}','::ffff:192.168.3.205','2026-08-03 13:44:18'),(235,1,'reset_list','lists',31,'{\"name\": \"newtestforpredic\", \"resetCount\": 0, \"dialableAfter\": 0, \"pendingRetries\": 0}','::ffff:192.168.3.205','2026-08-03 13:46:11'),(236,1,'update_campaign','campaigns',4,NULL,'::ffff:192.168.3.205','2026-08-03 13:46:14'),(237,1,'reset_list','lists',31,'{\"name\": \"newtestforpredic\", \"resetCount\": 0, \"dialableAfter\": 0, \"pendingRetries\": 0}','::ffff:192.168.3.205','2026-08-03 13:46:24'),(238,1,'upload_contacts','lists',32,'{\"dupMode\": \"none\", \"imported\": 1, \"campaignId\": 4, \"ignoredColumns\": [], \"skippedDuplicates\": 0}','::ffff:192.168.3.205','2026-08-03 13:46:43'),(239,1,'update_campaign','campaigns',4,NULL,'::ffff:192.168.3.205','2026-08-03 13:47:21'),(240,1,'upload_contacts','lists',32,'{\"dupMode\": \"none\", \"imported\": 1, \"campaignId\": 4, \"ignoredColumns\": [], \"skippedDuplicates\": 0}','::ffff:192.168.2.20','2026-08-03 13:52:10'),(241,23,'login','users',23,NULL,'::ffff:192.168.2.20','2026-08-03 13:52:42'),(242,1,'login','users',1,NULL,'::1','2026-08-03 13:55:58'),(243,23,'login','users',23,NULL,'::1','2026-08-03 13:56:35'),(244,1,'reset_list','lists',31,'{\"name\": \"newtestforpredic\", \"resetCount\": 1, \"dialableAfter\": 1, \"pendingRetries\": 1}','::1','2026-08-03 13:57:37'),(245,1,'update_list','lists',29,'{\"name\": \"test11\", \"fields\": [\"Customer Name\", \"Mobile No\", \"Ref - No\", \"Address\", \"City\", \"State\", \"POST CODE\", \"Product\", \"Product Dis\", \"REG NO\", \"DPD\", \"LMPD\", \"LPC\", \"CBC\", \"Tenure\", \"Dealer Name\", \"Process Name\", \"Ref - 1 Name\", \"Ref_2 Name\", \"Ref_2 No\", \"M_Data\", \"Other\", \"Toss\", \"Title (Priority Data)\", \"testtt\"], \"campaign_id\": 4, \"description\": \"test11\", \"previousCampaignId\": 1}','::1','2026-08-03 13:58:00'),(246,23,'login','users',23,NULL,'::1','2026-08-03 14:00:42'),(247,23,'login','users',23,NULL,'::ffff:192.168.3.205','2026-08-03 14:02:25'),(248,1,'delete_list','lists',29,'{\"name\": \"test11\", \"campaignId\": 4, \"deletedLeads\": 1}','::1','2026-08-03 14:03:43'),(249,1,'delete_list','lists',31,'{\"name\": \"newtestforpredic\", \"campaignId\": 4, \"deletedLeads\": 1}','::1','2026-08-03 14:03:47'),(250,1,'delete_list','lists',32,'{\"name\": \"newwww\", \"campaignId\": 4, \"deletedLeads\": 2}','::1','2026-08-03 14:03:50'),(251,1,'delete_list','lists',28,'{\"name\": \"newwwmanual\", \"campaignId\": 2, \"deletedLeads\": 2}','::1','2026-08-03 14:04:00'),(252,1,'create_list','lists',33,'{\"name\": \"shivasirtest\", \"active\": \"Y\", \"fields\": [\"Customer Name\", \"Mobile No\", \"Ref - No\", \"Address\", \"City\", \"State\", \"POST CODE\", \"Product\", \"Product Dis\", \"REG NO\", \"DPD\", \"LMPD\", \"LPC\", \"CBC\", \"Tenure\", \"Dealer Name\", \"Process Name\", \"Ref - 1 Name\", \"Ref_2 Name\", \"Ref_2 No\", \"M_Data\", \"Other\", \"Toss\", \"Title (Priority Data)\"], \"campaignId\": 4}','::1','2026-08-03 14:04:24'),(253,1,'upload_contacts','lists',33,'{\"dupMode\": \"none\", \"imported\": 1, \"campaignId\": 4, \"ignoredColumns\": [], \"skippedDuplicates\": 0}','::1','2026-08-03 14:04:41'),(254,1,'reset_list','lists',33,'{\"name\": \"shivasirtest\", \"resetCount\": 1, \"dialableAfter\": 1, \"pendingRetries\": 0}','::1','2026-08-03 14:05:30'),(255,1,'update_campaign','campaigns',4,NULL,'::1','2026-08-03 14:05:35'),(256,23,'logout','users',23,NULL,'::1','2026-08-03 14:13:08'),(257,1,'login','users',1,NULL,'::ffff:192.168.3.205','2026-08-03 22:50:44'),(258,1,'delete_list','lists',33,'{\"name\": \"shivasirtest\", \"campaignId\": 4, \"deletedLeads\": 1}','::ffff:192.168.3.205','2026-08-03 22:51:00'),(259,1,'delete_list','lists',3,'{\"name\": \"Default List\", \"campaignId\": 3, \"deletedLeads\": 1}','::ffff:192.168.3.205','2026-08-03 22:51:05'),(260,1,'create_list','lists',34,'{\"name\": \"afterdelete\", \"active\": \"Y\", \"fields\": [\"Customer Name\", \"Mobile No\", \"Ref - No\", \"Address\", \"City\", \"State\", \"POST CODE\", \"Product\", \"Product Dis\", \"REG NO\", \"DPD\", \"LMPD\", \"LPC\", \"CBC\", \"Tenure\", \"Dealer Name\", \"Process Name\", \"Ref - 1 Name\", \"Ref_2 Name\", \"Ref_2 No\", \"M_Data\", \"Other\", \"Toss\", \"Title (Priority Data)\", \"newww\"], \"campaignId\": 2}','::ffff:192.168.3.205','2026-08-03 22:52:02'),(261,1,'update_list','lists',34,'{\"name\": \"afterdelete\", \"fields\": [\"Customer Name\", \"Mobile No\", \"Ref - No\", \"Address\", \"City\", \"State\", \"POST CODE\", \"Product\", \"Product Dis\", \"REG NO\", \"DPD\", \"LMPD\", \"LPC\", \"CBC\", \"Tenure\", \"Dealer Name\", \"Process Name\", \"Ref - 1 Name\", \"Ref_2 Name\", \"Ref_2 No\", \"M_Data\", \"Other\", \"Toss\", \"Title (Priority Data)\", \"newww\"], \"campaign_id\": 4, \"description\": \"afterdelete\", \"previousCampaignId\": 2}','::ffff:192.168.3.205','2026-08-03 22:52:23'),(262,1,'upload_contacts','lists',34,'{\"dupMode\": \"none\", \"imported\": 1, \"campaignId\": 4, \"ignoredColumns\": [], \"skippedDuplicates\": 0}','::ffff:192.168.3.205','2026-08-03 22:52:44'),(263,23,'login','users',23,NULL,'::ffff:192.168.3.205','2026-08-03 22:53:21'),(264,1,'reset_list','lists',34,'{\"name\": \"afterdelete\", \"resetCount\": 1, \"dialableAfter\": 1, \"pendingRetries\": 1}','::ffff:192.168.3.205','2026-08-03 22:56:11'),(265,1,'update_campaign','campaigns',4,NULL,'::ffff:192.168.3.205','2026-08-03 22:56:14'),(266,1,'reset_list','lists',34,'{\"name\": \"afterdelete\", \"resetCount\": 1, \"dialableAfter\": 1, \"pendingRetries\": 0}','::ffff:192.168.3.205','2026-08-03 22:57:37'),(267,1,'update_campaign','campaigns',4,NULL,'::ffff:192.168.3.205','2026-08-03 22:57:40'),(268,1,'reset_list','lists',34,'{\"name\": \"afterdelete\", \"resetCount\": 0, \"dialableAfter\": 0, \"pendingRetries\": 0}','::ffff:192.168.3.205','2026-08-03 22:59:37'),(269,1,'update_campaign','campaigns',4,NULL,'::ffff:192.168.3.205','2026-08-03 22:59:41'),(270,1,'reset_list','lists',34,'{\"name\": \"afterdelete\", \"resetCount\": 0, \"dialableAfter\": 0, \"pendingRetries\": 0}','::ffff:192.168.3.205','2026-08-03 22:59:47'),(271,1,'reset_list','lists',34,'{\"name\": \"afterdelete\", \"resetCount\": 0, \"dialableAfter\": 0, \"pendingRetries\": 0}','::ffff:192.168.3.205','2026-08-03 22:59:58'),(272,1,'reset_list','lists',34,'{\"name\": \"afterdelete\", \"resetCount\": 0, \"dialableAfter\": 0, \"pendingRetries\": 0}','::ffff:192.168.3.205','2026-08-03 23:00:08'),(273,1,'reset_list','lists',34,'{\"name\": \"afterdelete\", \"resetCount\": 1, \"dialableAfter\": 1, \"pendingRetries\": 1}','::ffff:192.168.3.205','2026-08-03 23:00:34'),(274,1,'upload_contacts','lists',34,'{\"dupMode\": \"none\", \"imported\": 1, \"campaignId\": 4, \"ignoredColumns\": [], \"skippedDuplicates\": 0}','::ffff:192.168.3.205','2026-08-03 23:01:04'),(275,1,'reset_list','lists',34,'{\"name\": \"afterdelete\", \"resetCount\": 2, \"dialableAfter\": 2, \"pendingRetries\": 2}','::ffff:192.168.3.205','2026-08-03 23:04:18'),(276,1,'reset_list','lists',34,'{\"name\": \"afterdelete\", \"resetCount\": 1, \"dialableAfter\": 2, \"pendingRetries\": 1}','::ffff:192.168.3.205','2026-08-03 23:07:16'),(277,1,'create_list','lists',35,'{\"name\": \"c\", \"active\": \"Y\", \"fields\": [\"Customer Name\", \"Mobile No\", \"Ref - No\", \"Address\", \"City\", \"State\", \"POST CODE\", \"Product\", \"Product Dis\", \"REG NO\", \"DPD\", \"LMPD\", \"LPC\", \"CBC\", \"Tenure\", \"Dealer Name\", \"Process Name\", \"Ref - 1 Name\", \"Ref_2 Name\", \"Ref_2 No\", \"M_Data\", \"Other\", \"Toss\", \"Title (Priority Data)\"], \"campaignId\": 4}','::ffff:192.168.3.205','2026-08-03 23:07:51'),(278,1,'delete_list','lists',34,'{\"name\": \"afterdelete\", \"campaignId\": 4, \"deletedLeads\": 2}','::ffff:192.168.3.205','2026-08-03 23:08:04'),(279,1,'upload_contacts','lists',35,'{\"dupMode\": \"none\", \"imported\": 1, \"campaignId\": 4, \"ignoredColumns\": [], \"skippedDuplicates\": 0}','::ffff:192.168.3.205','2026-08-03 23:08:17'),(280,1,'reset_list','lists',35,'{\"name\": \"c\", \"resetCount\": 0, \"dialableAfter\": 0, \"pendingRetries\": 0}','::ffff:192.168.3.205','2026-08-03 23:12:14'),(281,1,'update_campaign','campaigns',4,NULL,'::ffff:192.168.3.205','2026-08-03 23:13:00'),(282,1,'delete_list','lists',35,'{\"name\": \"c\", \"campaignId\": 4, \"deletedLeads\": 1}','::ffff:192.168.3.205','2026-08-03 23:13:19'),(283,1,'create_list','lists',36,'{\"name\": \"testtt\", \"active\": \"Y\", \"fields\": [\"Customer Name\", \"Mobile No\", \"Ref - No\", \"Address\", \"City\", \"State\", \"POST CODE\", \"Product\", \"Product Dis\", \"REG NO\", \"DPD\", \"LMPD\", \"LPC\", \"CBC\", \"Tenure\", \"Dealer Name\", \"Process Name\", \"Ref - 1 Name\", \"Ref_2 Name\", \"Ref_2 No\", \"M_Data\", \"Other\", \"Toss\", \"Title (Priority Data)\"], \"campaignId\": 4}','::ffff:192.168.3.205','2026-08-03 23:13:33'),(284,1,'upload_contacts','lists',36,'{\"dupMode\": \"none\", \"imported\": 1, \"campaignId\": 4, \"ignoredColumns\": [], \"skippedDuplicates\": 0}','::ffff:192.168.3.205','2026-08-03 23:13:45'),(285,1,'login','users',1,NULL,'::ffff:192.168.3.205','2026-08-03 23:19:11'),(286,1,'logout','users',1,NULL,'::ffff:192.168.3.205','2026-08-03 23:19:49'),(287,NULL,'login_failed','users',NULL,'{\"email\": \"emp1@cc.test\"}','::ffff:192.168.3.205','2026-08-03 23:19:52'),(288,23,'login','users',23,NULL,'::ffff:192.168.3.205','2026-08-03 23:20:12'),(289,1,'login','users',1,NULL,'::1','2026-08-04 13:51:49'),(290,23,'login','users',23,NULL,'::1','2026-08-04 13:52:14'),(291,1,'update_campaign','campaigns',4,NULL,'::1','2026-08-04 13:52:47'),(292,1,'update_campaign','campaigns',4,NULL,'::1','2026-08-04 13:54:21'),(293,1,'login','users',1,NULL,'::ffff:192.168.3.205','2026-08-04 14:02:05'),(294,23,'login','users',23,NULL,'::ffff:192.168.3.205','2026-08-04 14:03:55'),(295,1,'update_campaign','campaigns',4,NULL,'::ffff:192.168.3.205','2026-08-04 14:04:09'),(296,1,'update_campaign','campaigns',4,NULL,'::ffff:192.168.3.205','2026-08-04 14:04:16'),(297,1,'reset_list','lists',36,'{\"name\": \"testtt\", \"resetCount\": 0, \"dialableAfter\": 1, \"pendingRetries\": 0}','::ffff:192.168.3.205','2026-08-04 14:06:29'),(298,1,'reset_list','lists',36,'{\"name\": \"testtt\", \"resetCount\": 0, \"dialableAfter\": 1, \"pendingRetries\": 0}','::ffff:192.168.3.205','2026-08-04 14:06:34'),(299,1,'update_campaign','campaigns',4,NULL,'::ffff:192.168.3.205','2026-08-04 14:06:36'),(300,1,'reset_list','lists',36,'{\"name\": \"testtt\", \"resetCount\": 0, \"dialableAfter\": 1, \"pendingRetries\": 0}','::ffff:192.168.3.205','2026-08-04 14:06:44'),(301,1,'reset_list','lists',36,'{\"name\": \"testtt\", \"resetCount\": 0, \"dialableAfter\": 1, \"pendingRetries\": 0}','::ffff:192.168.3.205','2026-08-04 14:06:56'),(302,1,'update_campaign','campaigns',4,NULL,'::ffff:192.168.3.205','2026-08-04 14:09:36'),(303,1,'login','users',1,NULL,'::1','2026-08-04 14:58:48'),(304,1,'create_campaign','campaigns',25,'{\"name\": \"neww\", \"gatewayIds\": [3], \"dialer_type\": \"ratio\"}','::1','2026-08-04 14:59:31'),(305,23,'login','users',23,NULL,'::ffff:192.168.3.205','2026-08-05 12:01:45'),(306,23,'login','users',23,NULL,'::1','2026-08-05 12:10:02'),(307,1,'login','users',1,NULL,'::1','2026-08-05 12:26:38'),(308,1,'update_list','lists',36,'{\"name\": \"testtt\", \"fields\": [\"Customer Name\", \"Mobile No\", \"Ref - No\", \"Address\", \"City\", \"State\", \"POST CODE\", \"Product\", \"Product Dis\", \"REG NO\", \"DPD\", \"LMPD\", \"LPC\", \"CBC\", \"Tenure\", \"Dealer Name\", \"Process Name\", \"Ref - 1 Name\", \"Ref_2 Name\", \"Ref_2 No\", \"M_Data\", \"Other\", \"Toss\", \"Title (Priority Data)\"], \"campaign_id\": 2, \"description\": \"testtt\", \"previousCampaignId\": 4}','::1','2026-08-05 12:27:21'),(309,1,'update_list','lists',37,'{\"name\": \"Default List\", \"fields\": [\"Customer Name\", \"Mobile No\", \"Ref - No\", \"Address\", \"City\", \"State\", \"POST CODE\", \"Product\", \"Product Dis\", \"REG NO\", \"DPD\", \"LMPD\", \"LPC\", \"CBC\", \"Tenure\", \"Dealer Name\", \"Process Name\", \"Ref - 1 Name\", \"Ref_2 Name\", \"Ref_2 No\", \"M_Data\", \"Other\", \"Toss\", \"Title (Priority Data)\", \"neww test\"], \"campaign_id\": 25, \"description\": null, \"previousCampaignId\": 25}','::1','2026-08-05 12:27:35'),(310,1,'update_list','lists',37,'{\"name\": \"Default List\", \"fields\": [\"Customer Name\", \"Mobile No\", \"Ref - No\", \"Address\", \"City\", \"State\", \"POST CODE\", \"Product\", \"Product Dis\", \"REG NO\", \"DPD\", \"LMPD\", \"LPC\", \"CBC\", \"Tenure\", \"Dealer Name\", \"Process Name\", \"Ref - 1 Name\", \"Ref_2 Name\", \"Ref_2 No\", \"M_Data\", \"Other\", \"Toss\", \"Title (Priority Data)\", \"neww test\"], \"campaign_id\": 4, \"description\": null, \"previousCampaignId\": 25}','::1','2026-08-05 12:27:54'),(311,1,'upload_contacts','lists',37,'{\"dupMode\": \"none\", \"imported\": 1, \"campaignId\": 4, \"ignoredColumns\": [], \"skippedDuplicates\": 0}','::1','2026-08-05 12:28:06'),(312,1,'reset_list','lists',37,'{\"name\": \"Default List\", \"resetCount\": 1, \"dialableAfter\": 1, \"pendingRetries\": 1}','::1','2026-08-05 12:28:56'),(313,1,'update_campaign','campaigns',4,NULL,'::1','2026-08-05 12:29:03'),(314,1,'update_campaign','campaigns',4,NULL,'::1','2026-08-05 13:04:30'),(315,23,'logout','users',23,NULL,'::1','2026-08-05 13:09:02'),(316,23,'logout','users',23,NULL,'::1','2026-08-05 13:09:02'),(317,23,'login','users',23,NULL,'::1','2026-08-05 18:39:40'),(318,1,'reset_list','lists',37,'{\"name\": \"Default List\", \"resetCount\": 1, \"dialableAfter\": 1, \"pendingRetries\": 0}','::1','2026-08-05 18:40:32'),(319,1,'update_campaign','campaigns',4,NULL,'::1','2026-08-05 18:40:36'),(320,1,'reset_list','lists',37,'{\"name\": \"Default List\", \"resetCount\": 1, \"dialableAfter\": 1, \"pendingRetries\": 0}','::1','2026-08-05 19:45:22'),(321,1,'update_campaign','campaigns',4,NULL,'::1','2026-08-05 19:45:27'),(322,1,'update_campaign','campaigns',4,NULL,'::1','2026-08-05 19:50:27'),(323,1,'reset_list','lists',37,'{\"name\": \"Default List\", \"resetCount\": 1, \"dialableAfter\": 1, \"pendingRetries\": 0}','::1','2026-08-05 19:50:57'),(324,1,'update_campaign','campaigns',4,NULL,'::1','2026-08-05 19:51:01'),(325,1,'update_list','lists',37,'{\"name\": \"Default List\", \"fields\": [\"Customer Name\", \"Mobile No\", \"Ref - No\", \"Address\", \"City\", \"State\", \"POST CODE\", \"Product\", \"Product Dis\", \"REG NO\", \"DPD\", \"LMPD\", \"LPC\", \"CBC\", \"Tenure\", \"Dealer Name\", \"Process Name\", \"Ref - 1 Name\", \"Ref_2 Name\", \"Ref_2 No\", \"M_Data\", \"Other\", \"Toss\", \"Title (Priority Data)\", \"neww test\"], \"campaign_id\": 25, \"description\": null, \"previousCampaignId\": 4}','::1','2026-08-05 19:55:41'),(326,1,'delete_campaign','campaigns',25,'{\"name\": \"neww\", \"deletedLeads\": 1, \"deletedLists\": 1}','::1','2026-08-05 19:59:32'),(327,1,'create_campaign','campaigns',26,'{\"name\": \"newratio\", \"gatewayIds\": [3], \"dialer_type\": \"ratio\"}','::1','2026-08-05 19:59:55'),(328,1,'update_list','lists',38,'{\"name\": \"Default List\", \"fields\": [\"Customer Name\", \"Mobile No\", \"Ref - No\", \"Address\", \"City\", \"State\", \"POST CODE\", \"Product\", \"Product Dis\", \"REG NO\", \"DPD\", \"LMPD\", \"LPC\", \"CBC\", \"Tenure\", \"Dealer Name\", \"Process Name\", \"Ref - 1 Name\", \"Ref_2 Name\", \"Ref_2 No\", \"M_Data\", \"Other\", \"Toss\", \"Title (Priority Data)\"], \"campaign_id\": 26, \"description\": null, \"previousCampaignId\": 26}','::1','2026-08-05 20:00:10'),(329,1,'upload_contacts','lists',38,'{\"dupMode\": \"none\", \"imported\": 1, \"campaignId\": 26, \"ignoredColumns\": [], \"skippedDuplicates\": 0}','::1','2026-08-05 20:00:43'),(330,1,'update_campaign','campaigns',26,NULL,'::1','2026-08-05 20:02:22'),(331,1,'login','users',1,NULL,'::1','2026-08-05 20:26:52'),(332,1,'update_list','lists',38,'{\"name\": \"Default List\", \"fields\": [\"Customer Name\", \"Mobile No\", \"Ref - No\", \"Address\", \"City\", \"State\", \"POST CODE\", \"Product\", \"Product Dis\", \"REG NO\", \"DPD\", \"LMPD\", \"LPC\", \"CBC\", \"Tenure\", \"Dealer Name\", \"Process Name\", \"Ref - 1 Name\", \"Ref_2 Name\", \"Ref_2 No\", \"M_Data\", \"Other\", \"Toss\", \"Title (Priority Data)\"], \"campaign_id\": 3, \"description\": null, \"previousCampaignId\": 26}','::1','2026-08-05 20:27:11'),(333,1,'reset_list','lists',38,'{\"name\": \"Default List\", \"resetCount\": 1, \"dialableAfter\": 0, \"pendingRetries\": 0}','::1','2026-08-05 20:27:33'),(334,1,'update_campaign','campaigns',3,NULL,'::1','2026-08-05 20:27:58'),(335,1,'reset_list','lists',38,'{\"name\": \"Default List\", \"resetCount\": 0, \"dialableAfter\": 0, \"pendingRetries\": 0}','::1','2026-08-05 20:29:27'),(336,1,'reset_list','lists',38,'{\"name\": \"Default List\", \"resetCount\": 1, \"dialableAfter\": 0, \"pendingRetries\": 0}','::1','2026-08-05 20:43:22'),(337,1,'update_list','lists',38,'{\"active\": \"N\", \"previousCampaignId\": 3}','::1','2026-08-05 20:44:10'),(338,1,'update_list','lists',38,'{\"active\": \"Y\", \"previousCampaignId\": 3}','::1','2026-08-05 20:44:11'),(339,1,'reset_list','lists',38,'{\"name\": \"Default List\", \"resetCount\": 0, \"dialableAfter\": 0, \"pendingRetries\": 0}','::1','2026-08-05 20:44:20'),(340,1,'update_list','lists',10,'{\"name\": \"Newtestforlist\", \"fields\": [\"Customer Name\", \"Mobile No\", \"Ref - No\", \"Address\", \"City\", \"State\", \"POST CODE\", \"Product\", \"Product Dis\", \"REG NO\", \"DPD\", \"LMPD\", \"LPC\", \"CBC\", \"Tenure\", \"Dealer Name\", \"Process Name\", \"Ref - 1 Name\", \"Ref_2 Name\", \"Ref_2 No\", \"M_Data\", \"Other\", \"Toss\", \"Title (Priority Data)\", \"checkfield\"], \"campaign_id\": 3, \"description\": \"Newtestforlist\", \"previousCampaignId\": 2}','::1','2026-08-05 20:47:41'),(341,1,'login','users',1,NULL,'::ffff:192.168.3.205','2026-08-14 15:32:12');
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `blocked_numbers`
--

DROP TABLE IF EXISTS `blocked_numbers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `blocked_numbers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `phone_number` varchar(32) NOT NULL COMMENT 'Normalised: digits and a leading + only',
  `campaign_id` int NOT NULL DEFAULT '0' COMMENT '0 = every campaign',
  `kind` enum('DNC','BLOCKED') NOT NULL DEFAULT 'BLOCKED',
  `reason` varchar(180) DEFAULT NULL,
  `source` varchar(32) NOT NULL DEFAULT 'rule-engine',
  `csv_data_id` int DEFAULT NULL COMMENT 'The lead whose wrap-up produced this entry',
  `created_by` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_blocked` (`phone_number`,`campaign_id`,`kind`),
  KEY `idx_blocked_lookup` (`phone_number`,`campaign_id`),
  KEY `idx_blocked_kind` (`kind`,`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `blocked_numbers`
--

LOCK TABLES `blocked_numbers` WRITE;
/*!40000 ALTER TABLE `blocked_numbers` DISABLE KEYS */;
INSERT INTO `blocked_numbers` VALUES (1,'9818435920',0,'DNC','DNC / DO_NOT_CALL','rule-engine',116,23,'2026-08-05 20:42:19');
/*!40000 ALTER TABLE `blocked_numbers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `breaks`
--

DROP TABLE IF EXISTS `breaks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `breaks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int NOT NULL,
  `break_type` enum('lunch','short','other') NOT NULL DEFAULT 'short',
  `reason` varchar(255) DEFAULT NULL,
  `status` enum('requested','approved','denied','active','completed') NOT NULL DEFAULT 'requested',
  `start_time` datetime DEFAULT NULL,
  `end_time` datetime DEFAULT NULL,
  `approved_by` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_breaks_employee` (`employee_id`),
  KEY `fk_breaks_approver` (`approved_by`),
  CONSTRAINT `fk_breaks_approver` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_breaks_employee` FOREIGN KEY (`employee_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `breaks`
--

LOCK TABLES `breaks` WRITE;
/*!40000 ALTER TABLE `breaks` DISABLE KEYS */;
/*!40000 ALTER TABLE `breaks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `call_notes`
--

DROP TABLE IF EXISTS `call_notes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `call_notes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `call_id` int NOT NULL,
  `employee_id` int NOT NULL,
  `note` text,
  `tags` varchar(255) DEFAULT NULL,
  `follow_up_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_notes_call` (`call_id`),
  KEY `fk_notes_employee` (`employee_id`),
  CONSTRAINT `fk_notes_call` FOREIGN KEY (`call_id`) REFERENCES `calls` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_notes_employee` FOREIGN KEY (`employee_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=62 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `call_notes`
--

LOCK TABLES `call_notes` WRITE;
/*!40000 ALTER TABLE `call_notes` DISABLE KEYS */;
INSERT INTO `call_notes` VALUES (1,1,22,NULL,NULL,NULL,'2026-06-24 17:29:23'),(2,2,22,NULL,NULL,NULL,'2026-06-24 17:38:20'),(3,3,22,NULL,NULL,NULL,'2026-06-24 17:44:22'),(4,4,22,NULL,NULL,NULL,'2026-06-24 17:48:58'),(5,5,22,NULL,NULL,NULL,'2026-06-24 17:50:54'),(6,6,22,'[SKIP - MIGR-Customer Migrated / Shift]','SKIP',NULL,'2026-06-24 17:58:38'),(7,7,22,NULL,NULL,NULL,'2026-06-24 18:25:50'),(8,8,22,NULL,NULL,NULL,'2026-06-24 18:26:44'),(9,9,23,NULL,NULL,NULL,'2026-06-24 21:25:15'),(10,10,22,NULL,NULL,NULL,'2026-06-24 21:47:36'),(11,11,22,NULL,NULL,NULL,'2026-06-24 21:49:19'),(12,12,22,NULL,NULL,NULL,'2026-06-24 21:51:43'),(13,13,22,NULL,NULL,NULL,'2026-06-24 21:51:48'),(14,14,22,NULL,NULL,NULL,'2026-06-24 21:54:10'),(15,15,22,NULL,NULL,NULL,'2026-06-24 21:54:34'),(16,16,23,NULL,NULL,NULL,'2026-06-26 15:16:36'),(17,17,25,NULL,NULL,NULL,'2026-06-26 15:16:37'),(18,18,25,NULL,NULL,NULL,'2026-06-26 15:27:22'),(19,19,23,NULL,NULL,NULL,'2026-06-26 15:29:42'),(20,20,23,NULL,NULL,NULL,'2026-06-26 15:33:27'),(21,21,23,NULL,NULL,NULL,'2026-06-26 15:33:55'),(22,22,23,NULL,NULL,NULL,'2026-06-26 15:34:37'),(23,23,25,NULL,NULL,NULL,'2026-06-26 15:34:43'),(24,24,23,NULL,NULL,NULL,'2026-06-27 19:58:16'),(25,25,23,'[SETT - Customer ready to pay settlement | amt:500 date:2026-06-25 mode:Bank Transfer]','SETT','2026-06-18 10:00:00','2026-06-27 20:24:51'),(26,26,23,NULL,NULL,NULL,'2026-06-27 20:26:15'),(27,27,23,'[CB - Call back later]','CB',NULL,'2026-06-27 23:40:57'),(28,28,23,NULL,NULL,NULL,'2026-06-28 00:18:29'),(29,29,23,'new note\n[NFI - VEHAC-Vehicle Met with Accident]','NFI',NULL,'2026-07-04 15:52:02'),(30,30,23,'new\n[SKIP - MIGR-Customer Migrated / Shift]','SKIP',NULL,'2026-07-04 15:53:39'),(31,31,23,'he said\n[TNC - Number busy]','TNC',NULL,'2026-07-04 16:04:03'),(32,32,23,'he said\n[PC - On the way (Branch)]','PC',NULL,'2026-07-07 13:02:44'),(33,33,23,'he s\n[NFI - VEHAC-Vehicle Met with Accident]','NFI',NULL,'2026-07-07 13:11:07'),(34,34,23,NULL,NULL,NULL,'2026-07-25 16:13:01'),(35,50,22,'[SI - NORC-RC Copy not Received]','SI',NULL,'2026-08-01 03:03:54'),(36,53,22,NULL,NULL,NULL,'2026-08-01 03:11:26'),(37,54,22,NULL,NULL,NULL,'2026-08-01 03:12:48'),(38,60,22,'was great\n[PAID - Full Paid]','PAID',NULL,'2026-08-02 12:47:08'),(39,75,22,NULL,NULL,NULL,'2026-08-02 14:43:24'),(40,76,22,NULL,NULL,NULL,'2026-08-02 14:46:35'),(41,77,22,NULL,NULL,NULL,'2026-08-02 14:47:56'),(42,78,22,NULL,NULL,NULL,'2026-08-02 14:49:15'),(43,91,23,NULL,NULL,NULL,'2026-08-03 14:00:25'),(44,95,23,'see',NULL,NULL,'2026-08-03 14:07:15'),(45,96,23,'[CB - Out of station]','CB','2026-08-03 15:11:00','2026-08-03 14:11:00'),(46,97,23,NULL,NULL,NULL,'2026-08-03 14:12:54'),(47,107,23,NULL,NULL,NULL,'2026-08-03 23:20:40'),(48,108,23,NULL,NULL,NULL,'2026-08-04 13:54:21'),(49,110,23,NULL,NULL,NULL,'2026-08-04 14:06:21'),(50,112,23,NULL,NULL,NULL,'2026-08-04 14:09:18'),(51,113,23,NULL,NULL,NULL,'2026-08-05 12:11:42'),(52,118,23,NULL,NULL,NULL,'2026-08-05 12:41:36'),(53,119,23,NULL,NULL,NULL,'2026-08-05 12:42:00'),(54,120,23,NULL,NULL,NULL,'2026-08-05 18:41:48'),(55,121,23,NULL,NULL,NULL,'2026-08-05 18:42:42'),(56,123,23,'dd\n[PAID - Settlement Paid]','PAID',NULL,'2026-08-05 19:49:13'),(57,125,23,'[FI - PFI-Permanent - Unemployed / Out of job]','FI',NULL,'2026-08-05 20:09:22'),(58,126,23,'[CB - Customer in Emergency]','CB',NULL,'2026-08-05 20:10:39'),(59,127,23,'[CB - Customer in Emergency]','CB',NULL,'2026-08-05 20:25:16'),(60,128,23,'[CD - Call drop]','CD',NULL,'2026-08-05 20:26:40'),(61,129,23,'[DNC - Customer asked not to be called]','DNC',NULL,'2026-08-05 20:42:19');
/*!40000 ALTER TABLE `call_notes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `calls`
--

DROP TABLE IF EXISTS `calls`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `calls` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int DEFAULT NULL COMMENT 'Agent who handled the call; NULL = attempt that never reached an agent',
  `campaign_id` int DEFAULT NULL,
  `csv_data_id` int DEFAULT NULL,
  `list_id` int DEFAULT NULL,
  `gateway_id` int DEFAULT NULL COMMENT 'gsm_gateways.id the attempt went out on',
  `phone_number` varchar(32) NOT NULL,
  `contact_name` varchar(150) DEFAULT NULL,
  `direction` enum('inbound','outbound') NOT NULL DEFAULT 'outbound',
  `dial_source` enum('manual','predictive','ratio','inbound','callback') NOT NULL DEFAULT 'manual',
  `attempt_no` int NOT NULL DEFAULT '0' COMMENT 'csv_data.call_count at the time of this attempt',
  `status` enum('dialing','ringing','connected','no_answer','busy','failed','voicemail','wrong_number','cancelled','abandoned','completed') NOT NULL DEFAULT 'dialing',
  `duration_seconds` int NOT NULL DEFAULT '0',
  `ring_seconds` int NOT NULL DEFAULT '0' COMMENT 'Seconds between dial and answer',
  `started_at` datetime DEFAULT NULL,
  `answered_at` datetime DEFAULT NULL,
  `ended_at` datetime DEFAULT NULL,
  `hangup_cause` varchar(64) DEFAULT NULL COMMENT 'Asterisk hangup cause / internal reason',
  `disposition` varchar(32) DEFAULT NULL COMMENT 'Agent disposition code (PTP, PAID, CB, ...)',
  `disposition_id` int DEFAULT NULL COMMENT 'dispositions.id — the business outcome of this attempt',
  `reason_id` int DEFAULT NULL COMMENT 'disposition_reasons.id — the business reason',
  `lead_status` varchar(32) DEFAULT NULL COMMENT 'Lead status this attempt produced',
  `channel_id` varchar(80) DEFAULT NULL COMMENT 'ARI channel id of the customer leg',
  `recording_url` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_calls_employee_created` (`employee_id`,`created_at`),
  KEY `idx_calls_status` (`status`),
  KEY `idx_calls_campaign_created` (`campaign_id`,`created_at`),
  KEY `idx_calls_gateway_created` (`gateway_id`,`created_at`),
  KEY `idx_calls_channel` (`channel_id`),
  KEY `idx_calls_csv_created` (`csv_data_id`,`created_at`),
  KEY `idx_calls_disposition` (`disposition_id`,`created_at`),
  CONSTRAINT `fk_calls_campaign` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_calls_csv` FOREIGN KEY (`csv_data_id`) REFERENCES `csv_data` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_calls_employee` FOREIGN KEY (`employee_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=130 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `calls`
--

LOCK TABLES `calls` WRITE;
/*!40000 ALTER TABLE `calls` DISABLE KEYS */;
INSERT INTO `calls` VALUES (1,22,1,NULL,NULL,NULL,'9818435920',NULL,'outbound','manual',0,'connected',0,0,'2026-06-24 17:29:23','2026-06-24 17:29:23','2026-06-24 17:29:23',NULL,NULL,NULL,NULL,'CONNECTED',NULL,NULL,'2026-06-24 17:29:23'),(2,22,1,NULL,NULL,NULL,'9818435920',NULL,'outbound','manual',0,'connected',0,0,'2026-06-24 17:38:20','2026-06-24 17:38:20','2026-06-24 17:38:20',NULL,NULL,NULL,NULL,'CONNECTED',NULL,NULL,'2026-06-24 17:38:20'),(3,22,1,NULL,NULL,NULL,'9818435920',NULL,'outbound','manual',0,'failed',0,0,'2026-06-24 17:44:22',NULL,'2026-06-24 17:44:22',NULL,NULL,NULL,NULL,'FAILED',NULL,NULL,'2026-06-24 17:44:22'),(4,22,1,NULL,NULL,NULL,'9818435920',NULL,'outbound','manual',0,'no_answer',0,0,'2026-06-24 17:48:58',NULL,'2026-06-24 17:48:58',NULL,NULL,NULL,NULL,'NO_ANSWER',NULL,NULL,'2026-06-24 17:48:58'),(5,22,1,NULL,NULL,NULL,'9818435920',NULL,'outbound','manual',0,'busy',0,0,'2026-06-24 17:50:54',NULL,'2026-06-24 17:50:54',NULL,NULL,NULL,NULL,'BUSY',NULL,NULL,'2026-06-24 17:50:54'),(6,22,1,NULL,NULL,NULL,'9818435920',NULL,'outbound','manual',0,'connected',14,0,'2026-06-24 17:58:24','2026-06-24 17:58:24','2026-06-24 17:58:38',NULL,NULL,NULL,NULL,'CONNECTED',NULL,NULL,'2026-06-24 17:58:38'),(7,22,2,NULL,NULL,NULL,'9818435920','MOHD SUHAIL','outbound','manual',0,'connected',25,0,'2026-06-24 18:25:25','2026-06-24 18:25:25','2026-06-24 18:25:50',NULL,NULL,NULL,NULL,'CONNECTED',NULL,NULL,'2026-06-24 18:25:50'),(8,22,2,NULL,NULL,NULL,'9318456120','SAMEER KHAN','outbound','manual',0,'connected',30,0,'2026-06-24 18:26:14','2026-06-24 18:26:14','2026-06-24 18:26:44',NULL,NULL,NULL,NULL,'CONNECTED',NULL,NULL,'2026-06-24 18:26:44'),(9,23,3,NULL,NULL,NULL,'9818435920',NULL,'outbound','manual',0,'no_answer',0,0,'2026-06-24 21:25:15',NULL,'2026-06-24 21:25:15',NULL,NULL,NULL,NULL,'NO_ANSWER',NULL,NULL,'2026-06-24 21:25:15'),(10,22,1,NULL,NULL,NULL,'9818435920',NULL,'outbound','manual',0,'connected',20,0,'2026-06-24 21:47:16','2026-06-24 21:47:16','2026-06-24 21:47:36',NULL,NULL,NULL,NULL,'CONNECTED',NULL,NULL,'2026-06-24 21:47:36'),(11,22,2,NULL,NULL,NULL,'9818435920','MOHD SUHAIL','outbound','manual',0,'connected',9,0,'2026-06-24 21:49:10','2026-06-24 21:49:10','2026-06-24 21:49:19',NULL,NULL,NULL,NULL,'CONNECTED',NULL,NULL,'2026-06-24 21:49:19'),(12,22,2,NULL,NULL,NULL,'9318456120','SAMEER KHAN','outbound','manual',0,'connected',22,0,'2026-06-24 21:51:21','2026-06-24 21:51:21','2026-06-24 21:51:43',NULL,NULL,NULL,NULL,'CONNECTED',NULL,NULL,'2026-06-24 21:51:43'),(13,22,2,NULL,NULL,NULL,'9318456120','SAMEER KHAN','outbound','manual',0,'connected',16,0,'2026-06-24 21:51:31','2026-06-24 21:51:31','2026-06-24 21:51:47',NULL,NULL,NULL,NULL,'CONNECTED',NULL,NULL,'2026-06-24 21:51:47'),(14,22,1,NULL,NULL,NULL,'9818435920',NULL,'outbound','manual',0,'no_answer',5,0,'2026-06-24 21:54:05',NULL,'2026-06-24 21:54:10',NULL,NULL,NULL,NULL,'NO_ANSWER',NULL,NULL,'2026-06-24 21:54:10'),(15,22,1,NULL,NULL,NULL,'9818435920',NULL,'outbound','manual',0,'no_answer',2,0,'2026-06-24 21:54:32',NULL,'2026-06-24 21:54:34',NULL,NULL,NULL,NULL,'NO_ANSWER',NULL,NULL,'2026-06-24 21:54:34'),(16,23,4,NULL,NULL,NULL,'9818435920','MOHD SUHAIL','outbound','manual',0,'connected',8,0,'2026-06-26 15:16:28','2026-06-26 15:16:28','2026-06-26 15:16:36',NULL,NULL,NULL,NULL,'CONNECTED',NULL,NULL,'2026-06-26 15:16:36'),(17,25,4,NULL,NULL,NULL,'7042949727','SAMEER KHAN','outbound','manual',0,'connected',15,0,'2026-06-26 15:16:22','2026-06-26 15:16:22','2026-06-26 15:16:37',NULL,NULL,NULL,NULL,'CONNECTED',NULL,NULL,'2026-06-26 15:16:37'),(18,25,4,NULL,NULL,NULL,'9818435920','SAMEER KHAN','outbound','manual',0,'connected',19,0,'2026-06-26 15:27:03','2026-06-26 15:27:03','2026-06-26 15:27:22',NULL,NULL,NULL,NULL,'CONNECTED',NULL,NULL,'2026-06-26 15:27:22'),(19,23,4,NULL,NULL,NULL,'9818435920','MOHD SUHAIL','outbound','manual',0,'connected',22,0,'2026-06-26 15:29:20','2026-06-26 15:29:20','2026-06-26 15:29:42',NULL,NULL,NULL,NULL,'CONNECTED',NULL,NULL,'2026-06-26 15:29:42'),(20,23,4,NULL,NULL,NULL,'8373909247','SAMEER KHAN','outbound','manual',0,'connected',70,0,'2026-06-26 15:32:17','2026-06-26 15:32:17','2026-06-26 15:33:27',NULL,NULL,NULL,NULL,'CONNECTED',NULL,NULL,'2026-06-26 15:33:27'),(21,23,4,NULL,NULL,NULL,'9818435920','MOHD SUHAIL','outbound','manual',0,'connected',31,0,'2026-06-26 15:33:24','2026-06-26 15:33:24','2026-06-26 15:33:55',NULL,NULL,NULL,NULL,'CONNECTED',NULL,NULL,'2026-06-26 15:33:55'),(22,23,4,NULL,NULL,NULL,'7065225319','SAMEER KHAN','outbound','manual',0,'connected',16,0,'2026-06-26 15:34:21','2026-06-26 15:34:21','2026-06-26 15:34:37',NULL,NULL,NULL,NULL,'CONNECTED',NULL,NULL,'2026-06-26 15:34:37'),(23,25,4,NULL,NULL,NULL,'7042949727','SAMEER KHAN','outbound','manual',0,'connected',63,0,'2026-06-26 15:33:40','2026-06-26 15:33:40','2026-06-26 15:34:43',NULL,NULL,NULL,NULL,'CONNECTED',NULL,NULL,'2026-06-26 15:34:43'),(24,23,3,NULL,NULL,NULL,'9818435920',NULL,'outbound','manual',0,'no_answer',14,0,'2026-06-27 19:58:02',NULL,'2026-06-27 19:58:16',NULL,NULL,NULL,NULL,'NO_ANSWER',NULL,NULL,'2026-06-27 19:58:16'),(25,23,4,NULL,NULL,NULL,'9818435920','MOHD SUHAIL','outbound','manual',0,'connected',29,0,'2026-06-27 20:24:22','2026-06-27 20:24:22','2026-06-27 20:24:51',NULL,NULL,NULL,NULL,'CONNECTED',NULL,NULL,'2026-06-27 20:24:51'),(26,23,3,NULL,NULL,NULL,'9818435920',NULL,'outbound','manual',0,'busy',8,0,'2026-06-27 20:26:07',NULL,'2026-06-27 20:26:15',NULL,NULL,NULL,NULL,'BUSY',NULL,NULL,'2026-06-27 20:26:15'),(27,23,4,NULL,NULL,NULL,'9818435920','MOHD SUHAIL','outbound','manual',0,'connected',11,0,'2026-06-27 23:40:46','2026-06-27 23:40:46','2026-06-27 23:40:57',NULL,NULL,NULL,NULL,'CONNECTED',NULL,NULL,'2026-06-27 23:40:57'),(28,23,3,NULL,NULL,NULL,'7065225319',NULL,'outbound','manual',0,'connected',25,0,'2026-06-28 00:18:03','2026-06-28 00:18:03','2026-06-28 00:18:28',NULL,NULL,NULL,NULL,'CONNECTED',NULL,NULL,'2026-06-28 00:18:28'),(29,23,3,NULL,NULL,NULL,'9818435920',NULL,'outbound','manual',0,'connected',18,0,'2026-07-04 15:51:44','2026-07-04 15:51:44','2026-07-04 15:52:02',NULL,NULL,NULL,NULL,'CONNECTED',NULL,NULL,'2026-07-04 15:52:02'),(30,23,4,NULL,NULL,NULL,'9818435920','MOHD SUHAIL','outbound','manual',0,'connected',5,0,'2026-07-04 15:53:34','2026-07-04 15:53:34','2026-07-04 15:53:39',NULL,NULL,NULL,NULL,'CONNECTED',NULL,NULL,'2026-07-04 15:53:39'),(31,23,4,NULL,NULL,NULL,'9818435920','MOHD SUHAIL','outbound','manual',0,'no_answer',40,0,'2026-07-04 16:03:23',NULL,'2026-07-04 16:04:03',NULL,NULL,NULL,NULL,'NO_ANSWER',NULL,NULL,'2026-07-04 16:04:03'),(32,23,3,NULL,NULL,NULL,'9818435920',NULL,'outbound','manual',0,'connected',38,0,'2026-07-07 13:02:06','2026-07-07 13:02:06','2026-07-07 13:02:44',NULL,NULL,NULL,NULL,'CONNECTED',NULL,NULL,'2026-07-07 13:02:44'),(33,23,3,NULL,NULL,NULL,'9968399778',NULL,'outbound','manual',0,'connected',19,0,'2026-07-07 13:10:48','2026-07-07 13:10:48','2026-07-07 13:11:07',NULL,NULL,NULL,NULL,'CONNECTED',NULL,NULL,'2026-07-07 13:11:07'),(34,23,NULL,NULL,NULL,NULL,'9818435920','MOHD SUHAIL','outbound','manual',0,'connected',4,0,'2026-07-25 16:12:57','2026-07-25 16:12:57','2026-07-25 16:13:01',NULL,NULL,NULL,NULL,'CONNECTED',NULL,NULL,'2026-07-25 16:13:01'),(43,NULL,4,40,10,3,'9818435920','Suhail','outbound','callback',2,'failed',0,0,'2026-08-01 02:32:38',NULL,'2026-08-01 02:33:10','Unknown',NULL,NULL,NULL,'FAILED','ams9fiaff0',NULL,'2026-08-01 02:32:38'),(50,22,2,40,10,3,'9818435920','Suhail','outbound','predictive',1,'connected',27,18,'2026-08-01 03:02:59','2026-08-01 03:03:17','2026-08-01 03:03:44',NULL,'SI',10,NULL,'CONNECTED','ams9glb3l0','rec-6001-9818435920-1785533600888.wav','2026-08-01 03:02:59'),(51,NULL,2,40,10,3,'9818435920','Suhail','outbound','predictive',2,'busy',0,0,'2026-08-01 03:05:31',NULL,'2026-08-01 03:06:08','User busy',NULL,NULL,NULL,'BUSY','ams9gokkc1',NULL,'2026-08-01 03:05:31'),(52,NULL,2,40,10,3,'9818435920','Suhail','outbound','predictive',1,'busy',0,0,'2026-08-01 03:09:52',NULL,'2026-08-01 03:10:00','User busy',NULL,NULL,NULL,'BUSY','ams9gu5ik2',NULL,'2026-08-01 03:09:52'),(53,22,2,40,10,3,'9818435920','Suhail','outbound','predictive',1,'connected',7,12,'2026-08-01 03:11:01','2026-08-01 03:11:13','2026-08-01 03:11:20',NULL,NULL,NULL,NULL,'CONNECTED','ams9gvmyj3','rec-6001-9818435920-1785534075121.wav','2026-08-01 03:11:01'),(54,22,2,40,10,3,'9818435920','Suhail','outbound','predictive',2,'connected',5,14,'2026-08-01 03:12:26','2026-08-01 03:12:40','2026-08-01 03:12:45',NULL,NULL,NULL,NULL,'CONNECTED','ams9gxgh14','rec-6001-9818435920-1785534161987.wav','2026-08-01 03:12:26'),(55,NULL,2,40,10,3,'9818435920','Suhail','outbound','predictive',3,'failed',0,0,'2026-08-01 03:13:48',NULL,'2026-08-01 15:25:32','stale',NULL,NULL,NULL,'FAILED','ams9gz81q5',NULL,'2026-08-01 03:13:48'),(60,22,2,40,10,3,'9818435920','Suhail','outbound','predictive',4,'connected',26,18,'2026-08-02 12:45:34','2026-08-02 12:45:52','2026-08-02 12:46:18',NULL,'PAID',1,NULL,'CONNECTED','amsbgudp10','rec-6001-9818435920-1785654956272.wav','2026-08-02 12:45:34'),(75,22,1,62,10,3,'9818435920','Suhail','outbound','manual',1,'connected',18,9,'2026-08-02 14:43:01','2026-08-02 14:43:10','2026-08-02 14:43:19','Normal Clearing',NULL,NULL,NULL,'CONNECTED','1785661981.6',NULL,'2026-08-02 14:43:01'),(76,22,2,40,10,3,'9818465920','Suhail','outbound','predictive',5,'connected',14,28,'2026-08-02 14:45:47','2026-08-02 14:46:15','2026-08-02 14:46:29',NULL,NULL,NULL,NULL,'CONNECTED','amsbl4yly0','rec-6001-9818465920-1785662176365.wav','2026-08-02 14:45:47'),(77,22,2,40,10,3,'9818465920','Suhail','outbound','predictive',6,'connected',8,10,'2026-08-02 14:47:36','2026-08-02 14:47:46','2026-08-02 14:47:54',NULL,NULL,NULL,NULL,'CONNECTED','amsbl7ao21','rec-6001-9818465920-1785662267152.wav','2026-08-02 14:47:36'),(78,22,2,40,10,3,'9818465920','Suhail','outbound','predictive',7,'connected',2,15,'2026-08-02 14:48:56','2026-08-02 14:49:11','2026-08-02 14:49:13',NULL,NULL,NULL,NULL,'CONNECTED','amsbl90yf2','rec-6001-9818465920-1785662351922.wav','2026-08-02 14:48:56'),(87,NULL,4,NULL,31,3,'7011455603','Shiva Kumar','outbound','predictive',1,'failed',0,0,'2026-08-03 13:41:57',NULL,'2026-08-03 13:43:57','stale',NULL,NULL,NULL,'FAILED','amscyaqu10',NULL,'2026-08-03 13:41:57'),(88,NULL,4,NULL,31,3,'7011455603','Shiva Kumar','outbound','predictive',1,'failed',0,0,'2026-08-03 13:44:58',NULL,'2026-08-03 13:46:58','stale',NULL,NULL,NULL,'FAILED','amscyelsz1',NULL,'2026-08-03 13:44:58'),(89,NULL,4,NULL,32,3,'7011455603','Shiva Kumar','outbound','predictive',1,'failed',0,0,'2026-08-03 13:47:58',NULL,'2026-08-03 13:49:58','stale',NULL,NULL,NULL,'FAILED','amscyigrg2',NULL,'2026-08-03 13:47:58'),(90,NULL,4,NULL,32,3,'9818435920','Shiva Kumar','outbound','predictive',1,'failed',0,0,'2026-08-03 13:52:47',NULL,'2026-08-03 13:54:47','stale',NULL,NULL,NULL,'FAILED','amscyonvm3',NULL,'2026-08-03 13:52:47'),(91,23,4,NULL,32,3,'9818435920','Shiva Kumar','outbound','predictive',2,'connected',19,13,'2026-08-03 13:58:29','2026-08-03 13:58:42','2026-08-03 13:59:01',NULL,NULL,NULL,NULL,'CONNECTED','amscyw04y0','rec-6002-9818435920-1785745727247.wav','2026-08-03 13:58:29'),(92,NULL,4,NULL,32,3,'9818435920','Shiva Kumar','outbound','predictive',3,'failed',0,0,'2026-08-03 14:02:30',NULL,'2026-08-03 14:04:30','stale',NULL,NULL,NULL,'FAILED','amscz15x64',NULL,'2026-08-03 14:02:30'),(93,23,4,NULL,32,3,'7011455603','Shiva Kumar','outbound','predictive',2,'cancelled',0,29,'2026-08-03 14:02:59','2026-08-03 14:03:28','2026-08-03 14:03:28','agent-unavailable',NULL,NULL,NULL,'CANCELLED','amscz1se61',NULL,'2026-08-03 14:02:59'),(94,23,4,NULL,33,3,'7011455603','Shiva Kumar','outbound','predictive',1,'cancelled',0,7,'2026-08-03 14:04:42','2026-08-03 14:04:49','2026-08-03 14:04:49','agent-unavailable',NULL,NULL,NULL,'CANCELLED','amscz3zgs2',NULL,'2026-08-03 14:04:42'),(95,23,4,NULL,33,3,'7011455603','Shiva Kumar','outbound','predictive',1,'connected',20,7,'2026-08-03 14:05:55','2026-08-03 14:06:02','2026-08-03 14:06:22',NULL,NULL,NULL,NULL,'CONNECTED','amscz5jq03','rec-6002-7011455603-1785746164527.wav','2026-08-03 14:05:55'),(96,23,4,NULL,33,3,'7011455603','Shiva Kumar','outbound','predictive',2,'connected',34,17,'2026-08-03 14:08:16','2026-08-03 14:08:33','2026-08-03 14:09:07',NULL,'CB',7,NULL,'CONNECTED','amscz8kme4','rec-6002-7011455603-1785746315300.wav','2026-08-03 14:08:16'),(97,23,4,NULL,33,3,'7011455603','Shiva Kumar','outbound','predictive',3,'connected',7,21,'2026-08-03 14:12:00','2026-08-03 14:12:21','2026-08-03 14:12:28',NULL,NULL,NULL,NULL,'CONNECTED','amsczddh75','rec-6002-7011455603-1785746543323.wav','2026-08-03 14:12:00'),(98,NULL,4,NULL,34,3,'9818435920','Shiva Kumar','outbound','predictive',1,'no_answer',0,0,'2026-08-03 22:55:36',NULL,'2026-08-03 22:56:06','Unknown',NULL,NULL,NULL,'NO_ANSWER','amsdi2q4q0',NULL,'2026-08-03 22:55:36'),(99,NULL,4,NULL,34,3,'9818435920','Shiva Kumar','outbound','predictive',1,'busy',0,0,'2026-08-03 22:57:07',NULL,'2026-08-03 22:57:35','User busy',NULL,NULL,NULL,'BUSY','amsdi4odp1',NULL,'2026-08-03 22:57:07'),(100,NULL,4,NULL,34,3,'9818435920','Shiva Kumar','outbound','predictive',1,'failed',0,0,'2026-08-03 22:58:35',NULL,'2026-08-03 23:00:35','stale',NULL,NULL,NULL,'FAILED','amsdi6kb02',NULL,'2026-08-03 22:58:35'),(101,NULL,4,NULL,34,3,'9818435920','Shiva Kumar','outbound','predictive',1,'failed',0,0,'2026-08-03 23:01:35',NULL,'2026-08-03 23:03:35','stale',NULL,NULL,NULL,'FAILED','amsdiaf8u3',NULL,'2026-08-03 23:01:35'),(102,NULL,4,NULL,34,3,'9818435920','Shiva Kumar','outbound','predictive',1,'failed',0,0,'2026-08-03 23:04:35',NULL,'2026-08-03 23:06:35','stale',NULL,NULL,NULL,'FAILED','amsdiea714',NULL,'2026-08-03 23:04:35'),(103,NULL,4,NULL,34,3,'9818435920','Shiva Kumar','outbound','predictive',1,'failed',0,0,'2026-08-03 23:07:35',NULL,'2026-08-03 23:09:35','stale',NULL,NULL,NULL,'FAILED','amsdii5575',NULL,'2026-08-03 23:07:35'),(104,NULL,4,NULL,35,3,'9818435920','Shiva Kumar','outbound','predictive',1,'no_answer',0,0,'2026-08-03 23:10:35',NULL,'2026-08-03 23:11:05','Unknown',NULL,NULL,NULL,'NO_ANSWER','amsdim03p6',NULL,'2026-08-03 23:10:35'),(105,NULL,4,NULL,35,3,'9818435920','Shiva Kumar','outbound','predictive',2,'failed',0,0,'2026-08-03 23:12:06',NULL,'2026-08-03 23:14:06','stale',NULL,NULL,NULL,'FAILED','amsdinyd47',NULL,'2026-08-03 23:12:06'),(106,NULL,4,114,36,3,'9818435920','Shiva Kumar','outbound','predictive',1,'failed',0,0,'2026-08-03 23:15:06',NULL,'2026-08-03 23:17:06','stale',NULL,NULL,NULL,'FAILED','amsdirtbu8',NULL,'2026-08-03 23:15:06'),(107,23,3,NULL,NULL,NULL,'9818435920',NULL,'outbound','manual',0,'no_answer',0,0,'2026-08-03 23:20:40',NULL,'2026-08-03 23:20:40',NULL,NULL,NULL,NULL,'NO_ANSWER',NULL,NULL,'2026-08-03 23:20:40'),(108,23,4,114,36,3,'9818435920','Shiva Kumar','outbound','predictive',2,'connected',15,17,'2026-08-04 13:53:37','2026-08-04 13:53:54','2026-08-04 13:54:09',NULL,NULL,NULL,NULL,'CONNECTED','amsee5l3l0','rec-6002-9818435920-1785831842485.wav','2026-08-04 13:53:37'),(109,NULL,4,114,36,3,'9818435920','Shiva Kumar','outbound','predictive',3,'no_answer',0,0,'2026-08-04 14:04:21',NULL,'2026-08-04 14:04:51','Unknown',NULL,NULL,NULL,'NO_ANSWER','amseejef70',NULL,'2026-08-04 14:04:21'),(110,23,4,114,36,3,'9818435920','Shiva Kumar','outbound','predictive',4,'connected',11,17,'2026-08-04 14:05:52','2026-08-04 14:06:09','2026-08-04 14:06:20',NULL,NULL,NULL,NULL,'CONNECTED','amseelco41','rec-6002-9818435920-1785832571808.wav','2026-08-04 14:05:52'),(111,NULL,4,114,36,3,'9818435920','Shiva Kumar','outbound','predictive',5,'no_answer',0,0,'2026-08-04 14:07:21',NULL,'2026-08-04 14:07:51','Unknown',NULL,NULL,NULL,'NO_ANSWER','amseen9dh2',NULL,'2026-08-04 14:07:21'),(112,23,4,114,36,3,'9818435920','Shiva Kumar','outbound','predictive',6,'connected',8,15,'2026-08-04 14:08:52','2026-08-04 14:09:07','2026-08-04 14:09:15',NULL,NULL,NULL,NULL,'CONNECTED','amseep7mq3','rec-6002-9818435920-1785832748082.wav','2026-08-04 14:08:52'),(113,23,4,NULL,NULL,NULL,'9818435920',NULL,'outbound','manual',0,'no_answer',0,0,'2026-08-05 12:11:42',NULL,'2026-08-05 12:11:42',NULL,NULL,NULL,NULL,'NO_ANSWER',NULL,NULL,'2026-08-05 12:11:42'),(114,NULL,4,NULL,37,3,'9818435920','Shiva Kumar','outbound','predictive',1,'failed',0,0,'2026-08-05 12:28:38',NULL,'2026-08-05 12:28:38','Circuit/channel congestion',NULL,NULL,NULL,'FAILED','amsfqk4vq0',NULL,'2026-08-05 12:28:38'),(115,NULL,4,NULL,37,3,'9818435920','Shiva Kumar','outbound','predictive',1,'failed',0,0,'2026-08-05 12:29:38',NULL,'2026-08-05 12:29:39','Circuit/channel congestion',NULL,NULL,NULL,'FAILED','amsfqlfsa1',NULL,'2026-08-05 12:29:38'),(116,NULL,4,NULL,37,3,'9818435920','Shiva Kumar','outbound','predictive',2,'failed',0,0,'2026-08-05 12:30:39',NULL,'2026-08-05 12:30:39','Circuit/channel congestion',NULL,NULL,NULL,'FAILED','amsfqmqfx2',NULL,'2026-08-05 12:30:39'),(117,NULL,4,NULL,37,3,'9818435920','Shiva Kumar','outbound','predictive',3,'cancelled',0,14,'2026-08-05 12:40:44','2026-08-05 12:40:58','2026-08-05 12:40:58','abandoned',NULL,NULL,NULL,'CANCELLED','amsfqzp003',NULL,'2026-08-05 12:40:44'),(118,23,3,NULL,NULL,NULL,'9818435920',NULL,'outbound','manual',0,'no_answer',0,0,'2026-08-05 12:41:36',NULL,'2026-08-05 12:41:36',NULL,NULL,NULL,NULL,'NO_ANSWER',NULL,NULL,'2026-08-05 12:41:36'),(119,23,3,NULL,NULL,NULL,'9818435920',NULL,'outbound','manual',0,'no_answer',0,0,'2026-08-05 12:42:00',NULL,'2026-08-05 12:42:00',NULL,NULL,NULL,NULL,'NO_ANSWER',NULL,NULL,'2026-08-05 12:42:00'),(120,23,4,NULL,37,3,'9818435920','Shiva Kumar','outbound','predictive',1,'connected',30,16,'2026-08-05 18:40:42','2026-08-05 18:40:58','2026-08-05 18:41:28',NULL,NULL,NULL,NULL,'CONNECTED','amsg3umrk0','rec-6002-9818435920-1785935461272.wav','2026-08-05 18:40:42'),(121,23,3,NULL,NULL,NULL,'9818435920',NULL,'outbound','manual',0,'no_answer',10,0,'2026-08-05 18:42:32',NULL,'2026-08-05 18:42:42',NULL,NULL,NULL,NULL,'NO_ANSWER',NULL,NULL,'2026-08-05 18:42:42'),(122,23,4,NULL,37,3,'9818435920','Shiva Kumar','outbound','predictive',2,'connected',9,14,'2026-08-05 18:42:48','2026-08-05 18:43:02','2026-08-05 18:43:11',NULL,NULL,NULL,NULL,'CONNECTED','amsg3xbkf1',NULL,'2026-08-05 18:42:48'),(123,23,4,NULL,37,3,'9818435920','Shiva Kumar','outbound','predictive',1,'connected',18,17,'2026-08-05 19:45:33','2026-08-05 19:45:50','2026-08-05 19:46:08',NULL,'PAID',1,2,'CONNECTED','amsg660w60','rec-6002-9818435920-1785939352511.wav','2026-08-05 19:45:33'),(124,NULL,4,NULL,37,3,'9818435920','Shiva Kumar','outbound','predictive',1,'busy',0,0,'2026-08-05 19:51:06',NULL,'2026-08-05 19:51:16','User busy',NULL,25,50,'BUSY','amsg6d5kj1',NULL,'2026-08-05 19:51:06'),(125,23,26,116,38,3,'9818435920','Shiva Kumar','outbound','ratio',1,'connected',10,15,'2026-08-05 20:07:50','2026-08-05 20:08:05','2026-08-05 20:08:15',NULL,'FI',8,17,'CONNECTED','amsg6yo5z2','rec-6002-9818435920-1785935583993.wav','2026-08-05 20:07:50'),(126,23,3,NULL,NULL,NULL,'9818435920',NULL,'outbound','manual',0,'connected',18,0,'2026-08-05 20:10:21','2026-08-05 20:10:21','2026-08-05 20:10:39',NULL,'CB',7,12,'CONNECTED',NULL,'rec-6002-9818435920-1785940814728.wav','2026-08-05 20:10:39'),(127,23,3,NULL,NULL,NULL,'9818435920',NULL,'outbound','manual',0,'no_answer',10,0,'2026-08-05 20:25:05',NULL,'2026-08-05 20:25:15',NULL,'CB',7,12,'NO_ANSWER',NULL,NULL,'2026-08-05 20:25:15'),(128,23,3,NULL,NULL,NULL,'9818435920',NULL,'outbound','manual',0,'connected',21,0,'2026-08-05 20:26:19','2026-08-05 20:26:19','2026-08-05 20:26:40',NULL,'CD',21,44,'CONNECTED',NULL,'rec-6002-9818435920-1785941780776.wav','2026-08-05 20:26:40'),(129,23,3,116,38,3,'9818435920','Shiva Kumar','outbound','manual',1,'no_answer',22,0,'2026-08-05 20:41:35',NULL,'2026-08-05 20:41:57','User busy','DNC',24,47,'NO_ANSWER','1785942695.172',NULL,'2026-08-05 20:41:35');
/*!40000 ALTER TABLE `calls` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `campaign_assignments`
--

DROP TABLE IF EXISTS `campaign_assignments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `campaign_assignments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `campaign_id` int NOT NULL,
  `employee_id` int NOT NULL,
  `assigned_by` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_assignment` (`campaign_id`,`employee_id`),
  KEY `fk_ca_employee` (`employee_id`),
  KEY `fk_ca_assigner` (`assigned_by`),
  CONSTRAINT `fk_ca_assigner` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ca_campaign` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ca_employee` FOREIGN KEY (`employee_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `campaign_assignments`
--

LOCK TABLES `campaign_assignments` WRITE;
/*!40000 ALTER TABLE `campaign_assignments` DISABLE KEYS */;
/*!40000 ALTER TABLE `campaign_assignments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `campaign_gateways`
--

DROP TABLE IF EXISTS `campaign_gateways`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `campaign_gateways` (
  `id` int NOT NULL AUTO_INCREMENT,
  `campaign_id` int NOT NULL,
  `gateway_id` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cg` (`campaign_id`,`gateway_id`),
  KEY `fk_cg_gateway` (`gateway_id`),
  CONSTRAINT `fk_cg_campaign` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cg_gateway` FOREIGN KEY (`gateway_id`) REFERENCES `gsm_gateways` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=39 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `campaign_gateways`
--

LOCK TABLES `campaign_gateways` WRITE;
/*!40000 ALTER TABLE `campaign_gateways` DISABLE KEYS */;
INSERT INTO `campaign_gateways` VALUES (12,2,3,'2026-06-24 18:24:11'),(26,1,3,'2026-06-24 22:04:24'),(33,3,3,'2026-07-04 14:52:32'),(36,4,3,'2026-08-03 23:13:00'),(38,26,3,'2026-08-05 19:59:55');
/*!40000 ALTER TABLE `campaign_gateways` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `campaigns`
--

DROP TABLE IF EXISTS `campaigns`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `campaigns` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(150) NOT NULL,
  `description` text,
  `script` text,
  `created_by` int DEFAULT NULL,
  `group_id` int DEFAULT NULL,
  `data_table_id` int DEFAULT NULL,
  `status` enum('active','paused','completed') NOT NULL DEFAULT 'active',
  `dialer_type` enum('predictive','manual','inbound','ratio') NOT NULL DEFAULT 'manual',
  `calling_start` time DEFAULT NULL,
  `calling_end` time DEFAULT NULL,
  `retry_count` int NOT NULL DEFAULT '0' COMMENT 'Max total dial attempts per lead; 0 = unlimited (recycle rules decide)',
  `retry_delay_minutes` int NOT NULL DEFAULT '60' COMMENT 'Fallback retry delay used when a recycle rule omits delay_min',
  `recording_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `dial_statuses` json DEFAULT NULL COMMENT 'Lead statuses the dialer may claim (JSON array); NULL = default NEW/no_answer/busy',
  `recycle_rules` json DEFAULT NULL COMMENT 'Auto-retry rules: [{status, delay_min, max_attempts}]; NULL/[] = no recycling',
  `dial_ratio` decimal(4,2) NOT NULL DEFAULT '1.00' COMMENT 'Lines dialled per READY agent (1.00 = progressive, >1 over-dials)',
  `dial_timeout_sec` int NOT NULL DEFAULT '45' COMMENT 'Seconds to let the customer leg ring before giving up',
  `wrapup_seconds` int NOT NULL DEFAULT '0' COMMENT 'Grace period after a call before the agent is offered another (0 = until the agent saves)',
  `lead_order` enum('oldest','newest','priority','random') NOT NULL DEFAULT 'oldest' COMMENT 'Order leads are claimed in',
  `callbacks_enabled` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'Feed due scheduled_calls back into the dial queue',
  `max_abandon_pct` decimal(5,2) NOT NULL DEFAULT '3.00' COMMENT 'Over-dialling is throttled when the abandon rate exceeds this',
  PRIMARY KEY (`id`),
  KEY `fk_campaigns_creator` (`created_by`),
  KEY `idx_campaigns_group` (`group_id`),
  CONSTRAINT `fk_campaigns_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_campaigns_group` FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `campaigns`
--

LOCK TABLES `campaigns` WRITE;
/*!40000 ALTER TABLE `campaigns` DISABLE KEYS */;
INSERT INTO `campaigns` VALUES (1,'RahulCampManual',NULL,NULL,1,1,1,'active','manual',NULL,NULL,9,60,0,'2026-06-24 17:16:27','[\"NO_ANSWER\", \"BUSY\", \"CONNECTED\", \"NEW\", \"VOICEMAIL\", \"CALLBACK\", \"FAILED\", \"CANCELLED\", \"WRONG_NUMBER\", \"COMPLETED\"]','[{\"status\": \"NO_ANSWER\", \"delay_min\": 60, \"max_attempts\": 3}, {\"status\": \"BUSY\", \"delay_min\": 30, \"max_attempts\": 3}, {\"status\": \"CONNECTED\", \"delay_min\": 1, \"max_attempts\": 5}]',1.00,45,0,'oldest',1,3.00),(2,'RahulCampPredict',NULL,NULL,1,1,1,'active','predictive',NULL,NULL,10,60,1,'2026-06-24 17:17:20','[]','[{\"status\": \"NO_ANSWER\", \"delay_min\": 1, \"max_attempts\": 3}, {\"status\": \"BUSY\", \"delay_min\": 1, \"max_attempts\": 3}, {\"status\": \"COMPLETED\", \"delay_min\": 1, \"max_attempts\": 3}, {\"status\": \"CONNECTED\", \"delay_min\": 1, \"max_attempts\": 10}, {\"status\": \"CANCELLED\", \"delay_min\": 1, \"max_attempts\": 3}, {\"status\": \"FAILED\", \"delay_min\": 1, \"max_attempts\": 3}]',1.00,45,0,'oldest',1,3.00),(3,'DeepakCampManul',NULL,NULL,1,2,1,'active','manual',NULL,NULL,0,60,0,'2026-06-24 17:17:49','[\"CONNECTED\", \"NEW\", \"BUSY\", \"CALLBACK\", \"VOICEMAIL\", \"WRONG_NUMBER\", \"CANCELLED\", \"FAILED\", \"NO_ANSWER\", \"COMPLETED\"]','[{\"status\": \"NO_ANSWER\", \"delay_min\": 60, \"max_attempts\": 3}, {\"status\": \"BUSY\", \"delay_min\": 30, \"max_attempts\": 3}, {\"status\": \"CONNECTED\", \"delay_min\": 1, \"max_attempts\": 4}]',1.00,45,0,'oldest',1,3.00),(4,'DeepakCampPredict',NULL,NULL,1,2,1,'active','predictive',NULL,NULL,40,60,1,'2026-06-24 17:18:20','[\"NEW\", \"BUSY\", \"FAILED\", \"NO_ANSWER\", \"CANCELLED\", \"WRONG_NUMBER\", \"COMPLETED\", \"VOICEMAIL\", \"CALLBACK\", \"CONNECTED\"]','[{\"status\": \"NO_ANSWER\", \"delay_min\": 1, \"max_attempts\": 3}, {\"status\": \"FAILED\", \"delay_min\": 1, \"max_attempts\": 3}, {\"status\": \"NO_ANSWER\", \"delay_min\": 1, \"max_attempts\": 3}, {\"status\": \"CONNECTED\", \"delay_min\": 1, \"max_attempts\": 16}, {\"status\": \"NO_ANSWER\", \"delay_min\": 60, \"max_attempts\": 3}]',1.00,30,0,'newest',1,3.00),(26,'newratio',NULL,NULL,1,2,NULL,'active','ratio',NULL,NULL,0,60,0,'2026-08-05 19:59:55','[\"NEW\", \"NO_ANSWER\", \"BUSY\", \"VOICEMAIL\", \"CALLBACK\", \"FAILED\", \"CANCELLED\", \"WRONG_NUMBER\", \"COMPLETED\", \"CONNECTED\"]','[{\"status\": \"NO_ANSWER\", \"delay_min\": 60, \"max_attempts\": 3}, {\"status\": \"BUSY\", \"delay_min\": 30, \"max_attempts\": 3}, {\"status\": \"FAILED\", \"delay_min\": 30, \"max_attempts\": 2}]',10.00,45,0,'oldest',1,3.00);
/*!40000 ALTER TABLE `campaigns` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `csv_data`
--

DROP TABLE IF EXISTS `csv_data`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `csv_data` (
  `id` int NOT NULL AUTO_INCREMENT,
  `campaign_id` int NOT NULL,
  `list_id` int DEFAULT NULL,
  `phone_number` varchar(32) NOT NULL,
  `name` varchar(150) DEFAULT NULL,
  `email` varchar(180) DEFAULT NULL,
  `company` varchar(150) DEFAULT NULL,
  `loan_account` varchar(64) DEFAULT NULL COMMENT 'Loan / account reference this lead belongs to (from the "Ref - No" field). Several leads may share one.',
  `custom_fields` json DEFAULT NULL,
  `called` tinyint(1) NOT NULL DEFAULT '0',
  `call_status` varchar(32) NOT NULL DEFAULT 'NEW' COMMENT 'Lead status: NEW = never dialed, else last disposition',
  `call_count` int NOT NULL DEFAULT '0',
  `last_call_at` datetime DEFAULT NULL,
  `recycle_attempts` int NOT NULL DEFAULT '0',
  `next_retry_at` datetime DEFAULT NULL COMMENT 'Redial queue: the lead is not claimable before this time',
  `priority` int NOT NULL DEFAULT '0' COMMENT 'Higher dials first (callbacks are injected with a high priority)',
  `pre_dial_status` varchar(32) DEFAULT NULL COMMENT 'Status the lead held before it was QUEUED — restored when a reservation expires',
  `last_disposition` varchar(32) DEFAULT NULL COMMENT 'Agent disposition code from the last wrap-up (PTP, PAID, CB, ...)',
  `last_disposition_id` int DEFAULT NULL COMMENT 'dispositions.id from the last wrap-up — the business outcome',
  `last_reason_id` int DEFAULT NULL COMMENT 'disposition_reasons.id from the last wrap-up',
  `last_gateway_id` int DEFAULT NULL COMMENT 'gsm_gateways.id used for the last attempt',
  `status_changed_at` datetime DEFAULT NULL COMMENT 'When call_status last changed',
  `completed_at` datetime DEFAULT NULL COMMENT 'Set when the lead reaches a terminal status (COMPLETED / WRONG_NUMBER / DNC)',
  `assigned_to` int DEFAULT NULL,
  `claimed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_csv_assigned` (`assigned_to`),
  KEY `idx_csv_campaign_called` (`campaign_id`,`called`),
  KEY `idx_csv_list_called` (`list_id`,`called`),
  KEY `idx_csv_dial` (`campaign_id`,`call_status`,`next_retry_at`),
  KEY `idx_csv_list_status` (`list_id`,`call_status`),
  KEY `idx_csv_claimed` (`claimed_at`),
  KEY `idx_csv_priority` (`campaign_id`,`priority`),
  KEY `idx_csv_loan` (`campaign_id`,`loan_account`),
  KEY `idx_csv_phone` (`phone_number`),
  CONSTRAINT `fk_csv_assigned` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_csv_campaign` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_csv_list` FOREIGN KEY (`list_id`) REFERENCES `lists` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=117 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `csv_data`
--

LOCK TABLES `csv_data` WRITE;
/*!40000 ALTER TABLE `csv_data` DISABLE KEYS */;
INSERT INTO `csv_data` VALUES (40,3,10,'9818465920','Suhail',NULL,NULL,NULL,'[[\"Ref - No\", \"REF100001\"], [\"Address\", \"123 Demo Street\"], [\"City\", \"Delhi\"], [\"State\", \"Delhi\"], [\"POST CODE\", \"110001\"], [\"Product\", \"Personal Loan\"], [\"Product Dis\", \"Demo Personal Loan\"], [\"REG NO\", \"DL01AB1234\"], [\"DPD\", \"0\"], [\"LMPD\", \"0\"], [\"LPC\", \"0\"], [\"CBC\", \"750\"], [\"Tenure\", \"24\"], [\"Dealer Name\", \"Demo Dealer\"], [\"Process Name\", \"Loan Process\"], [\"Ref - 1 Name\", \"Amit Kumar\"], [\"Ref_2 Name\", \"Rahul Sharma\"], [\"Ref_2 No\", \"9876543210\"], [\"M_Data\", \"Sample customer data\"], [\"Other\", \"Demo entry\"], [\"Toss\", \"Yes\"], [\"Title (Priority Data)\", \"High Priority\"]]',1,'CONNECTED',7,'2026-08-02 14:48:56',3,'2026-08-02 14:50:15',100,NULL,'PAID',NULL,NULL,3,'2026-08-05 21:51:47',NULL,NULL,NULL,'2026-07-31 22:56:09'),(62,3,10,'9818435920','Suhail',NULL,NULL,NULL,'[[\"Ref - No\", \"REF100001\"], [\"Address\", \"123 Demo Street\"], [\"City\", \"Delhi\"], [\"State\", \"Delhi\"], [\"POST CODE\", \"110001\"], [\"Product\", \"Personal Loan\"], [\"Product Dis\", \"Demo Personal Loan\"], [\"REG NO\", \"DL01AB1234\"], [\"DPD\", \"0\"], [\"LMPD\", \"0\"], [\"LPC\", \"0\"], [\"CBC\", \"750\"], [\"Tenure\", \"24\"], [\"Dealer Name\", \"Demo Dealer\"], [\"Process Name\", \"Loan Process\"], [\"Ref - 1 Name\", \"Amit Kumar\"], [\"Ref_2 Name\", \"Rahul Sharma\"], [\"Ref_2 No\", \"9876543210\"], [\"M_Data\", \"Sample customer data\"], [\"Other\", \"Demo entry\"], [\"Toss\", \"Yes\"], [\"Title (Priority Data)\", \"High Priority\"]]',1,'CONNECTED',1,'2026-08-02 14:43:01',0,'2026-08-02 15:43:24',100,NULL,NULL,NULL,NULL,3,'2026-08-02 15:58:15',NULL,NULL,NULL,'2026-08-01 19:14:12'),(63,3,10,'9818435920','Suhail',NULL,NULL,NULL,'[[\"Ref - No\", \"REF100001\"], [\"Address\", \"123 Demo Street\"], [\"City\", \"Delhi\"], [\"State\", \"Delhi\"], [\"POST CODE\", \"110001\"], [\"Product\", \"Personal Loan\"], [\"Product Dis\", \"Demo Personal Loan\"], [\"REG NO\", \"DL01AB1234\"], [\"DPD\", \"0\"], [\"LMPD\", \"0\"], [\"LPC\", \"0\"], [\"CBC\", \"750\"], [\"Tenure\", \"24\"], [\"Dealer Name\", \"Demo Dealer\"], [\"Process Name\", \"Loan Process\"], [\"Ref - 1 Name\", \"Amit Kumar\"], [\"Ref_2 Name\", \"Rahul Sharma\"], [\"Ref_2 No\", \"9876543210\"], [\"M_Data\", \"Sample customer data\"], [\"Other\", \"Demo entry\"], [\"Toss\", \"Yes\"], [\"Title (Priority Data)\", \"High Priority\"]]',0,'NEW',0,NULL,0,NULL,100,NULL,NULL,NULL,NULL,NULL,'2026-08-02 15:58:15',NULL,NULL,NULL,'2026-08-01 19:14:12'),(64,3,10,'9818435920','Suhail',NULL,NULL,NULL,'[[\"Ref - No\", \"REF100001\"], [\"Address\", \"123 Demo Street\"], [\"City\", \"Delhi\"], [\"State\", \"Delhi\"], [\"POST CODE\", \"110001\"], [\"Product\", \"Personal Loan\"], [\"Product Dis\", \"Demo Personal Loan\"], [\"REG NO\", \"DL01AB1234\"], [\"DPD\", \"0\"], [\"LMPD\", \"0\"], [\"LPC\", \"0\"], [\"CBC\", \"750\"], [\"Tenure\", \"24\"], [\"Dealer Name\", \"Demo Dealer\"], [\"Process Name\", \"Loan Process\"], [\"Ref - 1 Name\", \"Amit Kumar\"], [\"Ref_2 Name\", \"Rahul Sharma\"], [\"Ref_2 No\", \"9876543210\"], [\"M_Data\", \"Sample customer data\"], [\"Other\", \"Demo entry\"], [\"Toss\", \"Yes\"], [\"Title (Priority Data)\", \"High Priority\"]]',0,'NEW',0,NULL,0,NULL,100,NULL,NULL,NULL,NULL,NULL,'2026-08-02 15:58:14',NULL,NULL,NULL,'2026-08-01 19:14:12'),(65,3,10,'9818435920','Suhail',NULL,NULL,NULL,'[[\"Ref - No\", \"REF100001\"], [\"Address\", \"123 Demo Street\"], [\"City\", \"Delhi\"], [\"State\", \"Delhi\"], [\"POST CODE\", \"110001\"], [\"Product\", \"Personal Loan\"], [\"Product Dis\", \"Demo Personal Loan\"], [\"REG NO\", \"DL01AB1234\"], [\"DPD\", \"0\"], [\"LMPD\", \"0\"], [\"LPC\", \"0\"], [\"CBC\", \"750\"], [\"Tenure\", \"24\"], [\"Dealer Name\", \"Demo Dealer\"], [\"Process Name\", \"Loan Process\"], [\"Ref - 1 Name\", \"Amit Kumar\"], [\"Ref_2 Name\", \"Rahul Sharma\"], [\"Ref_2 No\", \"9876543210\"], [\"M_Data\", \"Sample customer data\"], [\"Other\", \"Demo entry\"], [\"Toss\", \"Yes\"], [\"Title (Priority Data)\", \"High Priority\"]]',0,'NEW',0,NULL,0,NULL,100,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-08-01 19:14:12'),(66,3,10,'9818435920','Suhail',NULL,NULL,NULL,'[[\"Ref - No\", \"REF100001\"], [\"Address\", \"123 Demo Street\"], [\"City\", \"Delhi\"], [\"State\", \"Delhi\"], [\"POST CODE\", \"110001\"], [\"Product\", \"Personal Loan\"], [\"Product Dis\", \"Demo Personal Loan\"], [\"REG NO\", \"DL01AB1234\"], [\"DPD\", \"0\"], [\"LMPD\", \"0\"], [\"LPC\", \"0\"], [\"CBC\", \"750\"], [\"Tenure\", \"24\"], [\"Dealer Name\", \"Demo Dealer\"], [\"Process Name\", \"Loan Process\"], [\"Ref - 1 Name\", \"Amit Kumar\"], [\"Ref_2 Name\", \"Rahul Sharma\"], [\"Ref_2 No\", \"9876543210\"], [\"M_Data\", \"Sample customer data\"], [\"Other\", \"Demo entry\"], [\"Toss\", \"Yes\"], [\"Title (Priority Data)\", \"High Priority\"]]',0,'NEW',0,NULL,0,NULL,100,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-08-01 19:14:12'),(67,3,10,'9818435920','Suhail',NULL,NULL,NULL,'[[\"Ref - No\", \"REF100001\"], [\"Address\", \"123 Demo Street\"], [\"City\", \"Delhi\"], [\"State\", \"Delhi\"], [\"POST CODE\", \"110001\"], [\"Product\", \"Personal Loan\"], [\"Product Dis\", \"Demo Personal Loan\"], [\"REG NO\", \"DL01AB1234\"], [\"DPD\", \"0\"], [\"LMPD\", \"0\"], [\"LPC\", \"0\"], [\"CBC\", \"750\"], [\"Tenure\", \"24\"], [\"Dealer Name\", \"Demo Dealer\"], [\"Process Name\", \"Loan Process\"], [\"Ref - 1 Name\", \"Amit Kumar\"], [\"Ref_2 Name\", \"Rahul Sharma\"], [\"Ref_2 No\", \"9876543210\"], [\"M_Data\", \"Sample customer data\"], [\"Other\", \"Demo entry\"], [\"Toss\", \"Yes\"], [\"Title (Priority Data)\", \"High Priority\"]]',0,'NEW',0,NULL,0,NULL,100,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-08-01 19:14:12'),(68,3,10,'9818435920','Suhail',NULL,NULL,NULL,'[[\"Ref - No\", \"REF100001\"], [\"Address\", \"123 Demo Street\"], [\"City\", \"Delhi\"], [\"State\", \"Delhi\"], [\"POST CODE\", \"110001\"], [\"Product\", \"Personal Loan\"], [\"Product Dis\", \"Demo Personal Loan\"], [\"REG NO\", \"DL01AB1234\"], [\"DPD\", \"0\"], [\"LMPD\", \"0\"], [\"LPC\", \"0\"], [\"CBC\", \"750\"], [\"Tenure\", \"24\"], [\"Dealer Name\", \"Demo Dealer\"], [\"Process Name\", \"Loan Process\"], [\"Ref - 1 Name\", \"Amit Kumar\"], [\"Ref_2 Name\", \"Rahul Sharma\"], [\"Ref_2 No\", \"9876543210\"], [\"M_Data\", \"Sample customer data\"], [\"Other\", \"Demo entry\"], [\"Toss\", \"Yes\"], [\"Title (Priority Data)\", \"High Priority\"]]',0,'NEW',0,NULL,0,NULL,100,NULL,NULL,NULL,NULL,NULL,'2026-08-02 17:20:08',NULL,NULL,NULL,'2026-08-01 19:14:12'),(69,3,10,'9818435920','Suhail',NULL,NULL,NULL,'[[\"Ref - No\", \"REF100001\"], [\"Address\", \"123 Demo Street\"], [\"City\", \"Delhi\"], [\"State\", \"Delhi\"], [\"POST CODE\", \"110001\"], [\"Product\", \"Personal Loan\"], [\"Product Dis\", \"Demo Personal Loan\"], [\"REG NO\", \"DL01AB1234\"], [\"DPD\", \"0\"], [\"LMPD\", \"0\"], [\"LPC\", \"0\"], [\"CBC\", \"750\"], [\"Tenure\", \"24\"], [\"Dealer Name\", \"Demo Dealer\"], [\"Process Name\", \"Loan Process\"], [\"Ref - 1 Name\", \"Amit Kumar\"], [\"Ref_2 Name\", \"Rahul Sharma\"], [\"Ref_2 No\", \"9876543210\"], [\"M_Data\", \"Sample customer data\"], [\"Other\", \"Demo entry\"], [\"Toss\", \"Yes\"], [\"Title (Priority Data)\", \"High Priority\"]]',0,'NEW',0,NULL,0,NULL,100,NULL,NULL,NULL,NULL,NULL,'2026-08-02 17:20:08',NULL,NULL,NULL,'2026-08-01 19:14:12'),(70,3,10,'9818435920','Suhail',NULL,NULL,NULL,'[[\"Ref - No\", \"REF100001\"], [\"Address\", \"123 Demo Street\"], [\"City\", \"Delhi\"], [\"State\", \"Delhi\"], [\"POST CODE\", \"110001\"], [\"Product\", \"Personal Loan\"], [\"Product Dis\", \"Demo Personal Loan\"], [\"REG NO\", \"DL01AB1234\"], [\"DPD\", \"0\"], [\"LMPD\", \"0\"], [\"LPC\", \"0\"], [\"CBC\", \"750\"], [\"Tenure\", \"24\"], [\"Dealer Name\", \"Demo Dealer\"], [\"Process Name\", \"Loan Process\"], [\"Ref - 1 Name\", \"Amit Kumar\"], [\"Ref_2 Name\", \"Rahul Sharma\"], [\"Ref_2 No\", \"9876543210\"], [\"M_Data\", \"Sample customer data\"], [\"Other\", \"Demo entry\"], [\"Toss\", \"Yes\"], [\"Title (Priority Data)\", \"High Priority\"]]',0,'NEW',0,NULL,0,NULL,100,NULL,NULL,NULL,NULL,NULL,'2026-08-02 17:20:09',NULL,NULL,NULL,'2026-08-01 19:14:12'),(71,3,10,'9818435720','Suhail',NULL,NULL,NULL,'[[\"Ref - No\", \"REF100001\"], [\"Address\", \"123 Demo Street\"], [\"City\", \"Delhi\"], [\"State\", \"Delhi\"], [\"POST CODE\", \"110001\"], [\"Product\", \"Personal Loan\"], [\"Product Dis\", \"Demo Personal Loan\"], [\"REG NO\", \"DL01AB1234\"], [\"DPD\", \"0\"], [\"LMPD\", \"0\"], [\"LPC\", \"0\"], [\"CBC\", \"750\"], [\"Tenure\", \"24\"], [\"Dealer Name\", \"Demo Dealer\"], [\"Process Name\", \"Loan Process\"], [\"Ref - 1 Name\", \"Amit Kumar\"], [\"Ref_2 Name\", \"Rahul Sharma\"], [\"Ref_2 No\", \"9876543210\"], [\"M_Data\", \"Sample customer data\"], [\"Other\", \"Demo entry\"], [\"Toss\", \"Yes\"], [\"Title (Priority Data)\", \"High Priority\"]]',0,'NEW',0,NULL,0,NULL,100,NULL,NULL,NULL,NULL,NULL,'2026-08-05 21:51:48',NULL,NULL,NULL,'2026-08-01 19:14:12'),(114,2,36,'9818435920','Shiva Kumar',NULL,NULL,NULL,'[[\"Ref - No\", \"REF102001\"], [\"Address\", \"123 Demo Street\"], [\"City\", \"Delhi\"], [\"State\", \"Delhi\"], [\"POST CODE\", \"110001\"], [\"Product\", \"Personal Loan\"], [\"Product Dis\", \"Demo Personal Loan\"], [\"REG NO\", \"DL01AC1234\"], [\"DPD\", \"0\"], [\"LMPD\", \"0\"], [\"LPC\", \"0\"], [\"CBC\", \"750\"], [\"Tenure\", \"24\"], [\"Dealer Name\", \"Demo Dealer\"], [\"Process Name\", \"Loan Process\"], [\"Ref - 1 Name\", \"Amit Kumar\"], [\"Ref_2 Name\", \"Shiva Kumar\"], [\"Ref_2 No\", \"9876543210\"], [\"M_Data\", \"Sample customer data\"], [\"Other\", \"Demo entry\"], [\"Toss\", \"Yes\"], [\"Title (Priority Data)\", \"High Priority\"]]',1,'CONNECTED',6,'2026-08-04 14:08:52',0,'2026-08-04 14:10:18',0,NULL,NULL,NULL,NULL,3,'2026-08-04 14:09:18',NULL,NULL,NULL,'2026-08-03 23:13:45'),(116,3,38,'9818435920','Shiva Kumar',NULL,NULL,NULL,'[[\"Ref - No\", \"REF102001\"], [\"Address\", \"123 Demo Street\"], [\"City\", \"Delhi\"], [\"State\", \"Delhi\"], [\"POST CODE\", \"110001\"], [\"Product\", \"Personal Loan\"], [\"Product Dis\", \"Demo Personal Loan\"], [\"REG NO\", \"DL01AC1234\"], [\"DPD\", \"0\"], [\"LMPD\", \"0\"], [\"LPC\", \"0\"], [\"CBC\", \"750\"], [\"Tenure\", \"24\"], [\"Dealer Name\", \"Demo Dealer\"], [\"Process Name\", \"Loan Process\"], [\"Ref - 1 Name\", \"Amit Kumar\"], [\"Ref_2 Name\", \"Shiva Kumar\"], [\"Ref_2 No\", \"9876543210\"], [\"M_Data\", \"Sample customer data\"], [\"Other\", \"Demo entry\"], [\"Toss\", \"Yes\"], [\"Title (Priority Data)\", \"High Priority\"]]',0,'DNC',0,'2026-08-05 20:41:35',0,NULL,0,NULL,NULL,NULL,NULL,3,'2026-08-05 20:42:19',NULL,NULL,NULL,'2026-08-05 20:00:43');
/*!40000 ALTER TABLE `csv_data` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `data_tables`
--

DROP TABLE IF EXISTS `data_tables`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `data_tables` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `columns` json NOT NULL COMMENT 'Ordered array of column names',
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_data_tables_creator` (`created_by`),
  CONSTRAINT `fk_data_tables_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `data_tables`
--

LOCK TABLES `data_tables` WRITE;
/*!40000 ALTER TABLE `data_tables` DISABLE KEYS */;
INSERT INTO `data_tables` VALUES (1,'CSV baja','[\"phone\", \"Proposal No\", \"Location,State\", \"Product\", \"EMI Amount\", \"Current Bucket\"]',1,'2026-06-24 11:45:12'),(2,'10','[\"new10\"]',1,'2026-07-04 10:37:05'),(3,'Default List','[\"Tital ( peority Data )\", \"Customer Name\", \"Address\", \"POST CODE\", \"Mobile NO\", \"LOAN NO\", \"Process Name\", \"City\", \"State\", \"CBC\", \"LPC\", \"Other\", \"Toss\", \"Product\", \"Product Dis\", \"REG NO\", \"Delear Name\", \"Tenure\", \"M_ Data\", \"LMPD\", \"DPD\", \"Ref -1 Name\", \"Ref - No\", \"Ref_2 Name\", \"Ref_2 No\"]',NULL,'2026-07-25 08:32:44'),(4,'BX Process','[\"Tital ( peority Data )\", \"Customer Name\", \"Address\", \"POST CODE\", \"Mobile NO\", \"LOAN NO\", \"Process Name\", \"City\", \"State\", \"EMI\", \"EMI OS\", \"CBC\", \"LPC\", \"Other\", \"Toss\", \"Product\", \"Product Dis\", \"REG NO\", \"Delear Name\", \"Tenure\", \"M_ Data\", \"LMPD\", \"Curent BKT\", \"DPD\", \"Bounce Reason\", \"Ref -1 Name\", \"Ref - No\", \"Ref_2 Name\", \"Ref_2 No\"]',NULL,'2026-07-25 08:32:45'),(5,'PI Process','[\"Tital ( peority Data )\", \"Customer Name\", \"Address\", \"POST CODE\", \"Mobile NO\", \"Loan NO\", \"Process Name\", \"City\", \"State\", \"CBC\", \"LPC\", \"Other\", \"Toss\", \"Product\", \"Product Dis\", \"REG NO\", \"Delear Name\", \"Tenure\", \"M_ Data\", \"LMPD\", \"DPD\", \"Sett Amount\", \"Ref -1 Name\", \"Ref - No\", \"Ref_2 Name\", \"Ref_2 No\", \"LM PAID Amount\", \"LM PAID Date\"]',NULL,'2026-07-25 08:32:46');
/*!40000 ALTER TABLE `data_tables` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `dialer_log`
--

DROP TABLE IF EXISTS `dialer_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dialer_log` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `csv_data_id` int DEFAULT NULL,
  `campaign_id` int DEFAULT NULL,
  `list_id` int DEFAULT NULL,
  `call_id` int DEFAULT NULL,
  `agent_id` int DEFAULT NULL,
  `gateway_id` int DEFAULT NULL,
  `event` varchar(40) NOT NULL COMMENT 'selected|reserved|dial_started|ringing|answered|connected|failed|retry_scheduled|retry_attempt|disposition|completed|released|recovered',
  `status_from` varchar(32) DEFAULT NULL,
  `status_to` varchar(32) DEFAULT NULL,
  `detail` json DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_dl_lead` (`csv_data_id`,`id`),
  KEY `idx_dl_campaign` (`campaign_id`,`created_at`),
  KEY `idx_dl_event` (`event`,`created_at`),
  KEY `idx_dl_call` (`call_id`)
) ENGINE=InnoDB AUTO_INCREMENT=394 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `dialer_log`
--

LOCK TABLES `dialer_log` WRITE;
/*!40000 ALTER TABLE `dialer_log` DISABLE KEYS */;
INSERT INTO `dialer_log` VALUES (3,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-01 02:29:07.180'),(4,40,4,NULL,NULL,23,NULL,'callback_queued',NULL,'CALLBACK','{\"type\": \"agent\", \"dueAt\": \"2026-06-18T04:30:00.000Z\"}','2026-08-01 02:29:08.603'),(5,40,4,10,NULL,NULL,NULL,'selected','CALLBACK','QUEUED','{\"phone\": \"9818435920\", \"attempt\": 2, \"recycle\": 0}','2026-08-01 02:32:36.862'),(6,40,4,10,43,NULL,3,'dial_started','QUEUED','DIALING','{\"phone\": \"9818435920\", \"source\": \"callback\", \"attempt\": 2, \"gateway\": \"dinstar\", \"endpoint\": \"gw3\"}','2026-08-01 02:32:39.941'),(7,40,4,10,43,NULL,3,'failed',NULL,'FAILED','{\"cause\": \"Unknown\", \"answered\": 0, \"durationSec\": 31}','2026-08-01 02:33:10.213'),(8,40,4,NULL,NULL,NULL,NULL,'released',NULL,'FAILED','{\"reason\": \"no-recycle-rule\", \"attempts\": 2}','2026-08-01 02:33:10.213'),(9,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-01 02:46:07.464'),(10,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-01 02:59:19.874'),(11,NULL,NULL,NULL,NULL,NULL,3,'gateway_down',NULL,NULL,'{\"name\": \"dinstar\", \"state\": \"offline\", \"endpoint\": \"gw3\"}','2026-08-01 02:59:59.943'),(12,NULL,NULL,NULL,NULL,NULL,3,'gateway_up',NULL,NULL,'{\"name\": \"dinstar\", \"state\": \"online\", \"endpoint\": \"gw3\"}','2026-08-01 03:00:19.875'),(13,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-01 03:01:08.598'),(14,40,2,10,NULL,NULL,NULL,'selected','FAILED','QUEUED','{\"phone\": \"9818435920\", \"attempt\": 1, \"recycle\": 0}','2026-08-01 03:02:59.205'),(15,40,2,10,50,NULL,3,'dial_started','QUEUED','DIALING','{\"phone\": \"9818435920\", \"source\": \"predictive\", \"attempt\": 1, \"gateway\": \"dinstar\", \"endpoint\": \"gw3\"}','2026-08-01 03:02:59.444'),(16,40,2,10,50,NULL,3,'answered',NULL,NULL,'{\"ringSec\": 19}','2026-08-01 03:03:17.962'),(17,40,2,10,50,22,3,'connected','RINGING','CONNECTED',NULL,'2026-08-01 03:03:21.473'),(18,40,2,NULL,50,22,NULL,'disposition',NULL,NULL,'{\"talkSec\": 23, \"awaiting\": \"agent-wrapup\"}','2026-08-01 03:03:44.589'),(19,40,2,10,50,22,NULL,'disposition','CONNECTED','CONNECTED','{\"disposition\": \"SI\", \"durationSec\": 23}','2026-08-01 03:03:57.178'),(20,40,2,NULL,NULL,NULL,NULL,'released',NULL,'CONNECTED','{\"reason\": \"no-recycle-rule\"}','2026-08-01 03:03:57.180'),(21,40,2,10,NULL,NULL,NULL,'selected','CONNECTED','QUEUED','{\"phone\": \"9818435920\", \"attempt\": 2, \"recycle\": 1}','2026-08-01 03:05:31.527'),(22,40,2,10,51,NULL,NULL,'retry_attempt',NULL,NULL,'{\"attempt\": 2, \"recycleAttempts\": 0}','2026-08-01 03:05:31.612'),(23,40,2,10,51,NULL,3,'dial_started','QUEUED','DIALING','{\"phone\": \"9818435920\", \"source\": \"predictive\", \"attempt\": 2, \"gateway\": \"dinstar\", \"endpoint\": \"gw3\"}','2026-08-01 03:05:31.982'),(24,40,2,10,NULL,NULL,NULL,'retry_scheduled',NULL,'BUSY','{\"at\": \"2026-07-31T22:06:08.433Z\", \"attempt\": 2, \"delayMin\": 30}','2026-08-01 03:06:08.720'),(25,40,2,10,51,NULL,3,'failed',NULL,'BUSY','{\"cause\": \"User busy\", \"answered\": 0, \"durationSec\": 37}','2026-08-01 03:06:08.720'),(26,40,2,10,NULL,NULL,NULL,'selected','BUSY','QUEUED','{\"phone\": \"9818435920\", \"attempt\": 1, \"recycle\": 0}','2026-08-01 03:09:51.772'),(27,40,2,10,52,NULL,3,'dial_started','QUEUED','DIALING','{\"phone\": \"9818435920\", \"source\": \"predictive\", \"attempt\": 1, \"gateway\": \"dinstar\", \"endpoint\": \"gw3\"}','2026-08-01 03:09:52.386'),(28,40,2,10,52,NULL,3,'failed',NULL,'BUSY','{\"cause\": \"User busy\", \"answered\": 0, \"durationSec\": 9}','2026-08-01 03:10:00.619'),(29,40,2,10,NULL,NULL,NULL,'retry_scheduled',NULL,'BUSY','{\"at\": \"2026-07-31T21:41:00.317Z\", \"attempt\": 1, \"delayMin\": 1}','2026-08-01 03:10:00.729'),(30,40,2,10,NULL,NULL,NULL,'selected','BUSY','QUEUED','{\"phone\": \"9818435920\", \"attempt\": 1, \"recycle\": 0}','2026-08-01 03:11:01.258'),(31,40,2,10,53,NULL,3,'dial_started','QUEUED','DIALING','{\"phone\": \"9818435920\", \"source\": \"predictive\", \"attempt\": 1, \"gateway\": \"dinstar\", \"endpoint\": \"gw3\"}','2026-08-01 03:11:01.433'),(32,40,2,10,53,NULL,3,'answered',NULL,NULL,'{\"ringSec\": 12}','2026-08-01 03:11:13.210'),(33,40,2,10,53,22,3,'connected','RINGING','CONNECTED',NULL,'2026-08-01 03:11:15.872'),(34,40,2,NULL,53,22,NULL,'disposition',NULL,NULL,'{\"talkSec\": 5, \"awaiting\": \"agent-wrapup\"}','2026-08-01 03:11:20.970'),(35,40,2,10,53,22,NULL,'disposition','CONNECTED','CONNECTED','{\"disposition\": \"-\", \"durationSec\": 5}','2026-08-01 03:11:26.549'),(36,40,2,NULL,NULL,NULL,NULL,'retry_scheduled',NULL,'CONNECTED','{\"at\": \"2026-07-31T21:42:26.215Z\", \"attempt\": 1, \"delayMin\": 1}','2026-08-01 03:11:26.563'),(37,40,2,10,NULL,NULL,NULL,'selected','CONNECTED','QUEUED','{\"phone\": \"9818435920\", \"attempt\": 2, \"recycle\": 1}','2026-08-01 03:12:26.136'),(38,40,2,10,54,NULL,NULL,'retry_attempt',NULL,NULL,'{\"attempt\": 2, \"recycleAttempts\": 0}','2026-08-01 03:12:26.211'),(39,40,2,10,54,NULL,3,'dial_started','QUEUED','DIALING','{\"phone\": \"9818435920\", \"source\": \"predictive\", \"attempt\": 2, \"gateway\": \"dinstar\", \"endpoint\": \"gw3\"}','2026-08-01 03:12:26.270'),(40,40,2,10,54,NULL,3,'answered',NULL,NULL,'{\"ringSec\": 15}','2026-08-01 03:12:40.768'),(41,40,2,10,54,22,3,'connected','RINGING','CONNECTED',NULL,'2026-08-01 03:12:42.646'),(42,40,2,NULL,54,22,NULL,'disposition',NULL,NULL,'{\"talkSec\": 3, \"awaiting\": \"agent-wrapup\"}','2026-08-01 03:12:45.772'),(43,40,2,10,54,22,NULL,'disposition','CONNECTED','CONNECTED','{\"disposition\": \"-\", \"durationSec\": 2}','2026-08-01 03:12:48.904'),(44,40,2,NULL,NULL,NULL,NULL,'retry_scheduled',NULL,'CONNECTED','{\"at\": \"2026-07-31T21:43:48.566Z\", \"attempt\": 2, \"delayMin\": 1}','2026-08-01 03:12:48.904'),(45,40,2,10,NULL,NULL,NULL,'selected','CONNECTED','QUEUED','{\"phone\": \"9818435920\", \"attempt\": 3, \"recycle\": 1}','2026-08-01 03:13:48.566'),(46,40,2,10,55,NULL,NULL,'retry_attempt',NULL,NULL,'{\"attempt\": 3, \"recycleAttempts\": 1}','2026-08-01 03:13:48.602'),(47,40,2,10,55,NULL,3,'dial_started','QUEUED','DIALING','{\"phone\": \"9818435920\", \"source\": \"predictive\", \"attempt\": 3, \"gateway\": \"dinstar\", \"endpoint\": \"gw3\"}','2026-08-01 03:13:48.650'),(48,NULL,NULL,NULL,NULL,NULL,3,'gateway_down',NULL,NULL,'{\"name\": \"dinstar\", \"state\": \"offline\", \"endpoint\": \"gw3\"}','2026-08-01 15:25:38.451'),(49,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"missing\", \"endpoint\": \"gw4\"}','2026-08-01 15:25:39.773'),(50,NULL,NULL,NULL,NULL,NULL,3,'gateway_up',NULL,NULL,'{\"name\": \"dinstar\", \"state\": \"online\", \"endpoint\": \"gw3\"}','2026-08-01 19:41:15.061'),(51,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-01 19:42:24.724'),(52,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-02 12:15:48.596'),(53,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-02 12:44:39.695'),(54,40,2,10,NULL,NULL,NULL,'selected','FAILED','QUEUED','{\"phone\": \"9818435920\", \"attempt\": 4, \"recycle\": 1}','2026-08-02 12:45:34.728'),(55,40,2,10,60,NULL,NULL,'retry_attempt',NULL,NULL,'{\"attempt\": 4, \"recycleAttempts\": 0}','2026-08-02 12:45:34.745'),(56,40,2,10,60,NULL,3,'dial_started','QUEUED','DIALING','{\"phone\": \"9818435920\", \"source\": \"predictive\", \"attempt\": 4, \"gateway\": \"dinstar\", \"endpoint\": \"gw3\"}','2026-08-02 12:45:34.754'),(57,40,2,10,60,NULL,3,'answered',NULL,NULL,'{\"ringSec\": 18}','2026-08-02 12:45:52.890'),(58,40,2,10,60,22,3,'connected','RINGING','CONNECTED',NULL,'2026-08-02 12:45:56.290'),(59,40,2,NULL,60,22,NULL,'disposition',NULL,NULL,'{\"talkSec\": 22, \"awaiting\": \"agent-wrapup\"}','2026-08-02 12:46:18.535'),(60,40,2,10,60,22,NULL,'disposition','CONNECTED','CONNECTED','{\"disposition\": \"PAID\", \"durationSec\": 22}','2026-08-02 12:47:08.201'),(61,40,2,NULL,NULL,NULL,NULL,'released',NULL,'CONNECTED','{\"reason\": \"no-recycle-rule\"}','2026-08-02 12:47:08.201'),(62,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-02 13:28:39.844'),(63,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-02 14:15:40.555'),(64,62,1,10,NULL,22,NULL,'reserved','NEW','QUEUED','{\"phone\": \"9818435920\", \"source\": \"manual\", \"attempt\": 1, \"recycle\": 0}','2026-08-02 14:19:53.159'),(65,40,1,10,NULL,22,NULL,'reserved','CONNECTED','QUEUED','{\"phone\": \"9818435920\", \"source\": \"manual\", \"attempt\": 5, \"recycle\": 1}','2026-08-02 14:22:41.157'),(66,40,1,10,NULL,22,NULL,'reserved','CONNECTED','QUEUED','{\"phone\": \"9818465920\", \"source\": \"manual\", \"attempt\": 5, \"recycle\": 1}','2026-08-02 14:25:12.732'),(67,62,1,10,NULL,22,NULL,'reserved','NEW','QUEUED','{\"phone\": \"9818435920\", \"source\": \"manual\", \"attempt\": 1, \"recycle\": 0}','2026-08-02 14:25:12.975'),(68,62,1,10,NULL,22,NULL,'released',NULL,NULL,'{\"reason\": \"skip\", \"source\": \"manual\"}','2026-08-02 14:25:19.029'),(69,63,1,10,NULL,22,NULL,'reserved','NEW','QUEUED','{\"phone\": \"9818435920\", \"source\": \"manual\", \"attempt\": 1, \"recycle\": 0}','2026-08-02 14:25:19.150'),(70,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-02 14:41:53.690'),(71,40,1,10,NULL,22,NULL,'reserved','CONNECTED','QUEUED','{\"phone\": \"9818465920\", \"source\": \"manual\", \"attempt\": 5, \"recycle\": 1}','2026-08-02 14:42:07.169'),(72,62,1,10,NULL,22,NULL,'reserved','NEW','QUEUED','{\"phone\": \"9818435920\", \"source\": \"manual\", \"attempt\": 1, \"recycle\": 0}','2026-08-02 14:42:07.406'),(73,62,1,10,75,22,3,'dial_started',NULL,'DIALING','{\"phone\": \"9818435920\", \"source\": \"manual\", \"attempt\": 1, \"gateway\": \"dinstar\"}','2026-08-02 14:43:01.618'),(74,62,1,NULL,75,22,3,'connected',NULL,'CONNECTED','{\"cause\": \"Normal Clearing\", \"source\": \"manual\"}','2026-08-02 14:43:20.256'),(75,62,1,10,75,22,NULL,'disposition','CONNECTED','CONNECTED','{\"disposition\": \"-\", \"durationSec\": 18}','2026-08-02 14:43:24.822'),(76,62,1,NULL,NULL,NULL,NULL,'retry_scheduled',NULL,'CONNECTED','{\"at\": \"2026-08-02T10:13:24.438Z\", \"attempt\": 1, \"delayMin\": 60}','2026-08-02 14:43:24.822'),(77,63,1,10,NULL,22,NULL,'reserved','NEW','QUEUED','{\"phone\": \"9818435920\", \"source\": \"manual\", \"attempt\": 1, \"recycle\": 0}','2026-08-02 14:43:25.496'),(78,64,1,10,NULL,22,NULL,'reserved','NEW','QUEUED','{\"phone\": \"9818435920\", \"source\": \"manual\", \"attempt\": 1, \"recycle\": 0}','2026-08-02 14:43:25.674'),(79,40,2,10,NULL,NULL,NULL,'selected','CONNECTED','QUEUED','{\"phone\": \"9818465920\", \"attempt\": 5, \"recycle\": 1}','2026-08-02 14:45:47.136'),(80,40,2,10,76,NULL,NULL,'retry_attempt',NULL,NULL,'{\"attempt\": 5, \"recycleAttempts\": 0}','2026-08-02 14:45:47.201'),(81,40,2,10,76,NULL,3,'dial_started','QUEUED','DIALING','{\"phone\": \"9818465920\", \"source\": \"predictive\", \"attempt\": 5, \"gateway\": \"dinstar\", \"endpoint\": \"gw3\"}','2026-08-02 14:45:47.242'),(82,40,2,10,76,NULL,3,'answered',NULL,NULL,'{\"ringSec\": 28}','2026-08-02 14:46:15.095'),(83,40,2,10,76,22,3,'connected','RINGING','CONNECTED',NULL,'2026-08-02 14:46:16.781'),(84,40,2,NULL,76,22,NULL,'disposition',NULL,NULL,'{\"talkSec\": 13, \"awaiting\": \"agent-wrapup\"}','2026-08-02 14:46:29.991'),(85,40,2,10,76,22,NULL,'disposition','CONNECTED','CONNECTED','{\"disposition\": \"-\", \"durationSec\": 13}','2026-08-02 14:46:35.621'),(86,40,2,NULL,NULL,NULL,NULL,'retry_scheduled',NULL,'CONNECTED','{\"at\": \"2026-08-02T09:17:35.242Z\", \"attempt\": 5, \"delayMin\": 1}','2026-08-02 14:46:35.621'),(87,40,2,10,NULL,NULL,NULL,'selected','CONNECTED','QUEUED','{\"phone\": \"9818465920\", \"attempt\": 6, \"recycle\": 1}','2026-08-02 14:47:36.050'),(88,40,2,10,77,NULL,NULL,'retry_attempt',NULL,NULL,'{\"attempt\": 6, \"recycleAttempts\": 1}','2026-08-02 14:47:36.138'),(89,40,2,10,77,NULL,3,'dial_started','QUEUED','DIALING','{\"phone\": \"9818465920\", \"source\": \"predictive\", \"attempt\": 6, \"gateway\": \"dinstar\", \"endpoint\": \"gw3\"}','2026-08-02 14:47:36.266'),(90,40,2,10,77,NULL,3,'answered',NULL,NULL,'{\"ringSec\": 10}','2026-08-02 14:47:46.296'),(91,40,2,10,77,22,3,'connected','RINGING','CONNECTED',NULL,'2026-08-02 14:47:47.576'),(92,40,2,NULL,77,22,NULL,'disposition',NULL,NULL,'{\"talkSec\": 7, \"awaiting\": \"agent-wrapup\"}','2026-08-02 14:47:54.496'),(93,40,2,10,77,22,NULL,'disposition','CONNECTED','CONNECTED','{\"disposition\": \"-\", \"durationSec\": 7}','2026-08-02 14:47:56.863'),(94,40,2,NULL,NULL,NULL,NULL,'retry_scheduled',NULL,'CONNECTED','{\"at\": \"2026-08-02T09:18:56.481Z\", \"attempt\": 6, \"delayMin\": 1}','2026-08-02 14:47:56.878'),(95,40,2,10,NULL,NULL,NULL,'selected','CONNECTED','QUEUED','{\"phone\": \"9818465920\", \"attempt\": 7, \"recycle\": 1}','2026-08-02 14:48:56.815'),(96,40,2,10,78,NULL,NULL,'retry_attempt',NULL,NULL,'{\"attempt\": 7, \"recycleAttempts\": 2}','2026-08-02 14:48:56.860'),(97,40,2,10,78,NULL,3,'dial_started','QUEUED','DIALING','{\"phone\": \"9818465920\", \"source\": \"predictive\", \"attempt\": 7, \"gateway\": \"dinstar\", \"endpoint\": \"gw3\"}','2026-08-02 14:48:56.912'),(98,40,2,10,78,NULL,3,'answered',NULL,NULL,'{\"ringSec\": 15}','2026-08-02 14:49:11.553'),(99,40,2,10,78,22,3,'connected','RINGING','CONNECTED',NULL,'2026-08-02 14:49:12.364'),(100,40,2,NULL,78,22,NULL,'disposition',NULL,NULL,'{\"talkSec\": 1, \"awaiting\": \"agent-wrapup\"}','2026-08-02 14:49:13.641'),(101,40,2,10,78,22,NULL,'disposition','CONNECTED','CONNECTED','{\"disposition\": \"-\", \"durationSec\": 1}','2026-08-02 14:49:15.516'),(102,40,2,NULL,NULL,NULL,NULL,'retry_scheduled',NULL,'CONNECTED','{\"at\": \"2026-08-02T09:20:15.139Z\", \"attempt\": 7, \"delayMin\": 1}','2026-08-02 14:49:15.519'),(103,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-02 14:59:41.075'),(104,34,1,3,NULL,22,NULL,'reserved','NEW','QUEUED','{\"phone\": \"9818435920\", \"source\": \"manual\", \"attempt\": 1, \"recycle\": 0}','2026-08-02 15:01:15.437'),(105,34,1,3,NULL,22,NULL,'reserved','NEW','QUEUED','{\"phone\": \"9818435920\", \"source\": \"manual\", \"attempt\": 1, \"recycle\": 0}','2026-08-02 15:09:32.577'),(106,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-02 15:24:18.519'),(107,34,1,3,NULL,22,NULL,'released',NULL,NULL,'{\"reason\": \"skip\", \"source\": \"manual\"}','2026-08-02 15:37:10.514'),(108,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-02 15:40:40.417'),(109,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-02 16:01:47.953'),(110,34,1,3,NULL,22,NULL,'reserved','NEW','QUEUED','{\"phone\": \"9818435920\", \"source\": \"manual\", \"attempt\": 1, \"recycle\": 0}','2026-08-02 16:04:38.861'),(111,34,1,3,NULL,22,NULL,'reserved','NEW','QUEUED','{\"phone\": \"9818435920\", \"source\": \"manual\", \"attempt\": 1, \"recycle\": 0}','2026-08-02 16:07:33.285'),(112,98,1,25,NULL,22,NULL,'reserved','NEW','QUEUED','{\"phone\": \"9818435920\", \"source\": \"manual\", \"attempt\": 1, \"recycle\": 0}','2026-08-02 16:07:58.488'),(113,100,1,27,NULL,22,NULL,'reserved','NEW','QUEUED','{\"phone\": \"9000000000\", \"source\": \"manual\", \"attempt\": 1, \"recycle\": 0}','2026-08-02 16:20:58.085'),(114,101,1,28,NULL,22,NULL,'reserved','NEW','QUEUED','{\"phone\": \"8000000000\", \"source\": \"manual\", \"attempt\": 1, \"recycle\": 0}','2026-08-02 16:28:44.316'),(115,101,1,28,NULL,22,NULL,'reserved','NEW','QUEUED','{\"phone\": \"8000000000\", \"source\": \"manual\", \"attempt\": 1, \"recycle\": 0}','2026-08-02 16:36:09.323'),(116,101,1,28,NULL,22,NULL,'reserved','NEW','QUEUED','{\"phone\": \"8000000000\", \"source\": \"manual\", \"attempt\": 1, \"recycle\": 0}','2026-08-02 16:38:36.807'),(117,102,1,28,NULL,22,NULL,'reserved','NEW','QUEUED','{\"phone\": \"7000000000\", \"source\": \"manual\", \"attempt\": 1, \"recycle\": 0}','2026-08-02 16:38:36.998'),(118,103,1,29,NULL,22,NULL,'reserved','NEW','QUEUED','{\"phone\": \"7000000000\", \"source\": \"manual\", \"attempt\": 1, \"recycle\": 0}','2026-08-02 16:44:26.318'),(119,103,1,29,NULL,22,NULL,'reserved','NEW','QUEUED','{\"phone\": \"7000000000\", \"source\": \"manual\", \"attempt\": 1, \"recycle\": 0}','2026-08-02 16:48:36.198'),(120,103,1,29,NULL,22,NULL,'reserved','NEW','QUEUED','{\"phone\": \"7000000000\", \"source\": \"manual\", \"attempt\": 1, \"recycle\": 0}','2026-08-02 16:51:13.594'),(121,103,1,29,NULL,22,NULL,'reserved','NEW','QUEUED','{\"phone\": \"7000000000\", \"source\": \"manual\", \"attempt\": 1, \"recycle\": 0}','2026-08-02 17:13:36.861'),(122,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-02 17:27:44.051'),(123,103,1,29,NULL,22,NULL,'reserved','NEW','QUEUED','{\"phone\": \"7000000000\", \"source\": \"manual\", \"attempt\": 1, \"recycle\": 0}','2026-08-02 17:32:11.107'),(124,103,1,29,NULL,22,NULL,'reserved','NEW','QUEUED','{\"phone\": \"7000000000\", \"source\": \"manual\", \"attempt\": 1, \"recycle\": 0}','2026-08-02 18:23:25.535'),(125,107,4,31,NULL,NULL,NULL,'selected','NEW','QUEUED','{\"phone\": \"7011455603\", \"attempt\": 1, \"recycle\": 0}','2026-08-03 13:41:57.902'),(126,107,4,31,87,NULL,3,'dial_started','QUEUED','DIALING','{\"phone\": \"7011455603\", \"source\": \"predictive\", \"attempt\": 1, \"gateway\": \"dinstar\", \"endpoint\": \"gw3\"}','2026-08-03 13:41:57.929'),(127,107,NULL,NULL,NULL,NULL,NULL,'recovered',NULL,NULL,'{\"reason\": \"stale-in-flight\"}','2026-08-03 13:43:28.958'),(128,107,4,31,87,NULL,3,'failed',NULL,'FAILED','{\"cause\": \"stale\", \"answered\": 0, \"durationSec\": 120}','2026-08-03 13:43:57.982'),(129,107,4,31,NULL,NULL,NULL,'retry_scheduled',NULL,'FAILED','{\"at\": \"2026-08-03T08:14:57.972Z\", \"attempt\": 1, \"delayMin\": 1}','2026-08-03 13:43:57.982'),(130,107,4,31,NULL,NULL,NULL,'selected','FAILED','QUEUED','{\"phone\": \"7011455603\", \"attempt\": 1, \"recycle\": 0}','2026-08-03 13:44:58.012'),(131,107,4,31,88,NULL,3,'dial_started','QUEUED','DIALING','{\"phone\": \"7011455603\", \"source\": \"predictive\", \"attempt\": 1, \"gateway\": \"dinstar\", \"endpoint\": \"gw3\"}','2026-08-03 13:44:58.028'),(132,107,NULL,NULL,NULL,NULL,NULL,'recovered',NULL,NULL,'{\"reason\": \"stale-in-flight\"}','2026-08-03 13:46:29.060'),(133,107,4,31,88,NULL,3,'failed',NULL,'FAILED','{\"cause\": \"stale\", \"answered\": 0, \"durationSec\": 120}','2026-08-03 13:46:58.083'),(134,107,4,31,NULL,NULL,NULL,'retry_scheduled',NULL,'FAILED','{\"at\": \"2026-08-03T08:17:58.073Z\", \"attempt\": 1, \"delayMin\": 1}','2026-08-03 13:46:58.083'),(135,108,4,32,NULL,NULL,NULL,'selected','NEW','QUEUED','{\"phone\": \"7011455603\", \"attempt\": 1, \"recycle\": 0}','2026-08-03 13:47:58.100'),(136,108,4,32,89,NULL,3,'dial_started','QUEUED','DIALING','{\"phone\": \"7011455603\", \"source\": \"predictive\", \"attempt\": 1, \"gateway\": \"dinstar\", \"endpoint\": \"gw3\"}','2026-08-03 13:47:58.119'),(137,108,NULL,NULL,NULL,NULL,NULL,'recovered',NULL,NULL,'{\"reason\": \"stale-in-flight\"}','2026-08-03 13:49:30.150'),(138,108,4,32,89,NULL,3,'failed',NULL,'FAILED','{\"cause\": \"stale\", \"answered\": 0, \"durationSec\": 120}','2026-08-03 13:49:58.174'),(139,108,4,32,NULL,NULL,NULL,'retry_scheduled',NULL,'FAILED','{\"at\": \"2026-08-03T08:20:58.165Z\", \"attempt\": 1, \"delayMin\": 1}','2026-08-03 13:49:58.175'),(140,109,4,32,NULL,NULL,NULL,'selected','NEW','QUEUED','{\"phone\": \"9818435920\", \"attempt\": 1, \"recycle\": 0}','2026-08-03 13:52:47.255'),(141,109,4,32,90,NULL,3,'dial_started','QUEUED','DIALING','{\"phone\": \"9818435920\", \"source\": \"predictive\", \"attempt\": 1, \"gateway\": \"dinstar\", \"endpoint\": \"gw3\"}','2026-08-03 13:52:47.277'),(142,109,NULL,NULL,NULL,NULL,NULL,'recovered',NULL,NULL,'{\"reason\": \"stale-in-flight\"}','2026-08-03 13:54:30.304'),(143,109,4,32,90,NULL,3,'failed',NULL,'FAILED','{\"cause\": \"stale\", \"answered\": 0, \"durationSec\": 120}','2026-08-03 13:54:47.312'),(144,109,4,32,NULL,NULL,NULL,'retry_scheduled',NULL,'FAILED','{\"at\": \"2026-08-03T08:25:47.304Z\", \"attempt\": 1, \"delayMin\": 1}','2026-08-03 13:54:47.312'),(145,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-03 13:55:05.742'),(146,109,4,32,NULL,NULL,NULL,'selected','FAILED','QUEUED','{\"phone\": \"9818435920\", \"attempt\": 2, \"recycle\": 1}','2026-08-03 13:58:29.838'),(147,109,4,32,91,NULL,NULL,'retry_attempt',NULL,NULL,'{\"attempt\": 2, \"recycleAttempts\": 0}','2026-08-03 13:58:30.052'),(148,109,4,32,91,NULL,3,'dial_started','QUEUED','DIALING','{\"phone\": \"9818435920\", \"source\": \"predictive\", \"attempt\": 2, \"gateway\": \"dinstar\", \"endpoint\": \"gw3\"}','2026-08-03 13:58:30.159'),(149,109,4,32,91,NULL,3,'answered',NULL,NULL,'{\"ringSec\": 12}','2026-08-03 13:58:42.541'),(150,109,4,32,91,23,3,'connected','RINGING','CONNECTED',NULL,'2026-08-03 13:58:49.219'),(151,109,4,NULL,91,23,NULL,'disposition',NULL,NULL,'{\"talkSec\": 13, \"awaiting\": \"agent-wrapup\"}','2026-08-03 13:59:01.914'),(152,109,4,32,91,23,NULL,'disposition','CONNECTED','CONNECTED','{\"disposition\": \"-\", \"durationSec\": 13}','2026-08-03 14:00:25.893'),(153,109,4,NULL,NULL,NULL,NULL,'retry_scheduled',NULL,'CONNECTED','{\"at\": \"2026-08-03T08:31:25.580Z\", \"attempt\": 2, \"delayMin\": 1}','2026-08-03 14:00:25.894'),(154,109,4,32,NULL,NULL,NULL,'selected','CONNECTED','QUEUED','{\"phone\": \"9818435920\", \"attempt\": 3, \"recycle\": 1}','2026-08-03 14:02:30.515'),(155,109,4,32,92,NULL,NULL,'retry_attempt',NULL,NULL,'{\"attempt\": 3, \"recycleAttempts\": 0}','2026-08-03 14:02:30.523'),(156,109,4,32,92,NULL,3,'dial_started','QUEUED','DIALING','{\"phone\": \"9818435920\", \"source\": \"predictive\", \"attempt\": 3, \"gateway\": \"dinstar\", \"endpoint\": \"gw3\"}','2026-08-03 14:02:30.531'),(157,108,4,32,NULL,NULL,NULL,'selected','FAILED','QUEUED','{\"phone\": \"7011455603\", \"attempt\": 2, \"recycle\": 1}','2026-08-03 14:02:59.798'),(158,108,4,32,93,NULL,NULL,'retry_attempt',NULL,NULL,'{\"attempt\": 2, \"recycleAttempts\": 0}','2026-08-03 14:02:59.896'),(159,108,4,32,93,NULL,3,'dial_started','QUEUED','DIALING','{\"phone\": \"7011455603\", \"source\": \"predictive\", \"attempt\": 2, \"gateway\": \"dinstar\", \"endpoint\": \"gw3\"}','2026-08-03 14:02:59.965'),(160,108,4,32,93,NULL,3,'answered',NULL,NULL,'{\"ringSec\": 29}','2026-08-03 14:03:28.613'),(161,108,4,NULL,NULL,NULL,NULL,'released',NULL,'CANCELLED','{\"reason\": \"no-recycle-rule\", \"attempts\": 2}','2026-08-03 14:03:28.831'),(162,108,4,32,93,NULL,3,'failed',NULL,'CANCELLED','{\"cause\": \"agent-unavailable\", \"answered\": 1, \"durationSec\": 29}','2026-08-03 14:03:28.831'),(163,109,4,32,92,NULL,3,'failed',NULL,'FAILED','{\"cause\": \"stale\", \"answered\": 0, \"durationSec\": 120}','2026-08-03 14:04:30.564'),(164,110,4,33,NULL,NULL,NULL,'selected','NEW','QUEUED','{\"phone\": \"7011455603\", \"attempt\": 1, \"recycle\": 0}','2026-08-03 14:04:42.320'),(165,110,4,33,94,NULL,3,'dial_started','QUEUED','DIALING','{\"phone\": \"7011455603\", \"source\": \"predictive\", \"attempt\": 1, \"gateway\": \"dinstar\", \"endpoint\": \"gw3\"}','2026-08-03 14:04:42.591'),(166,110,4,33,94,NULL,3,'answered',NULL,NULL,'{\"ringSec\": 7}','2026-08-03 14:04:49.304'),(167,110,4,33,94,NULL,3,'failed',NULL,'CANCELLED','{\"cause\": \"agent-unavailable\", \"answered\": 1, \"durationSec\": 7}','2026-08-03 14:04:49.667'),(168,110,4,NULL,NULL,NULL,NULL,'released',NULL,'CANCELLED','{\"reason\": \"no-recycle-rule\", \"attempts\": 1}','2026-08-03 14:04:49.669'),(169,110,4,33,NULL,NULL,NULL,'selected','CANCELLED','QUEUED','{\"phone\": \"7011455603\", \"attempt\": 1, \"recycle\": 0}','2026-08-03 14:05:54.818'),(170,110,4,33,95,NULL,3,'dial_started','QUEUED','DIALING','{\"phone\": \"7011455603\", \"source\": \"predictive\", \"attempt\": 1, \"gateway\": \"dinstar\", \"endpoint\": \"gw3\"}','2026-08-03 14:05:55.607'),(171,110,4,33,95,NULL,3,'answered',NULL,NULL,'{\"ringSec\": 8}','2026-08-03 14:06:02.835'),(172,110,4,33,95,23,3,'connected','RINGING','CONNECTED',NULL,'2026-08-03 14:06:05.587'),(173,110,4,NULL,95,23,NULL,'disposition',NULL,NULL,'{\"talkSec\": 18, \"awaiting\": \"agent-wrapup\"}','2026-08-03 14:06:22.786'),(174,110,4,33,95,23,NULL,'disposition','CONNECTED','CONNECTED','{\"disposition\": \"-\", \"durationSec\": 18}','2026-08-03 14:07:18.092'),(175,110,4,NULL,NULL,NULL,NULL,'retry_scheduled',NULL,'CONNECTED','{\"at\": \"2026-08-03T08:38:16.479Z\", \"attempt\": 1, \"delayMin\": 1}','2026-08-03 14:07:18.093'),(176,110,4,33,NULL,NULL,NULL,'selected','CONNECTED','QUEUED','{\"phone\": \"7011455603\", \"attempt\": 2, \"recycle\": 1}','2026-08-03 14:08:16.349'),(177,110,4,33,96,NULL,NULL,'retry_attempt',NULL,NULL,'{\"attempt\": 2, \"recycleAttempts\": 0}','2026-08-03 14:08:16.416'),(178,110,4,33,96,NULL,3,'dial_started','QUEUED','DIALING','{\"phone\": \"7011455603\", \"source\": \"predictive\", \"attempt\": 2, \"gateway\": \"dinstar\", \"endpoint\": \"gw3\"}','2026-08-03 14:08:16.491'),(179,110,4,33,96,NULL,3,'answered',NULL,NULL,'{\"ringSec\": 17}','2026-08-03 14:08:33.891'),(180,110,4,33,96,23,3,'connected','RINGING','CONNECTED',NULL,'2026-08-03 14:08:35.661'),(181,110,4,NULL,96,23,NULL,'disposition',NULL,NULL,'{\"talkSec\": 31, \"awaiting\": \"agent-wrapup\"}','2026-08-03 14:09:07.121'),(182,110,4,33,96,23,NULL,'disposition','CONNECTED','CONNECTED','{\"followUp\": \"2026-08-03 15:11\", \"disposition\": \"CB\", \"durationSec\": 31}','2026-08-03 14:11:00.363'),(183,110,4,NULL,NULL,NULL,NULL,'retry_scheduled',NULL,'CONNECTED','{\"at\": \"2026-08-03T08:42:00.068Z\", \"attempt\": 2, \"delayMin\": 1}','2026-08-03 14:11:00.363'),(184,110,4,33,NULL,NULL,NULL,'selected','CONNECTED','QUEUED','{\"phone\": \"7011455603\", \"attempt\": 3, \"recycle\": 1}','2026-08-03 14:12:00.348'),(185,110,4,33,97,NULL,NULL,'retry_attempt',NULL,NULL,'{\"attempt\": 3, \"recycleAttempts\": 1}','2026-08-03 14:12:00.433'),(186,110,4,33,97,NULL,3,'dial_started','QUEUED','DIALING','{\"phone\": \"7011455603\", \"source\": \"predictive\", \"attempt\": 3, \"gateway\": \"dinstar\", \"endpoint\": \"gw3\"}','2026-08-03 14:12:00.492'),(187,110,4,33,97,NULL,3,'answered',NULL,NULL,'{\"ringSec\": 21}','2026-08-03 14:12:21.608'),(188,110,4,33,97,23,3,'connected','RINGING','CONNECTED',NULL,'2026-08-03 14:12:24.731'),(189,110,4,NULL,97,23,NULL,'disposition',NULL,NULL,'{\"talkSec\": 4, \"awaiting\": \"agent-wrapup\"}','2026-08-03 14:12:28.221'),(190,110,4,33,97,23,NULL,'disposition','CONNECTED','CONNECTED','{\"disposition\": \"-\", \"durationSec\": 2}','2026-08-03 14:13:02.196'),(191,110,4,NULL,NULL,NULL,NULL,'retry_scheduled',NULL,'CONNECTED','{\"at\": \"2026-08-03T08:43:58.501Z\", \"attempt\": 3, \"delayMin\": 1}','2026-08-03 14:13:02.196'),(192,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-03 22:36:40.666'),(193,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-03 22:38:37.984'),(194,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-03 22:39:16.937'),(195,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-03 22:40:14.587'),(196,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-03 22:49:00.877'),(197,111,4,34,NULL,NULL,NULL,'selected','NEW','QUEUED','{\"phone\": \"9818435920\", \"attempt\": 1, \"recycle\": 0}','2026-08-03 22:55:36.065'),(198,111,4,34,98,NULL,3,'dial_started','QUEUED','DIALING','{\"phone\": \"9818435920\", \"source\": \"predictive\", \"attempt\": 1, \"gateway\": \"dinstar\", \"endpoint\": \"gw3\"}','2026-08-03 22:55:36.092'),(199,111,4,34,98,NULL,3,'failed',NULL,'NO_ANSWER','{\"cause\": \"Unknown\", \"answered\": 0, \"durationSec\": 30}','2026-08-03 22:56:06.113'),(200,111,4,34,NULL,NULL,NULL,'retry_scheduled',NULL,'NO_ANSWER','{\"at\": \"2026-08-03T17:27:06.104Z\", \"attempt\": 1, \"delayMin\": 1}','2026-08-03 22:56:06.113'),(201,111,4,34,NULL,NULL,NULL,'selected','NO_ANSWER','QUEUED','{\"phone\": \"9818435920\", \"attempt\": 1, \"recycle\": 0}','2026-08-03 22:57:07.107'),(202,111,4,34,99,NULL,3,'dial_started','QUEUED','DIALING','{\"phone\": \"9818435920\", \"source\": \"predictive\", \"attempt\": 1, \"gateway\": \"dinstar\", \"endpoint\": \"gw3\"}','2026-08-03 22:57:07.126'),(203,111,4,34,99,NULL,3,'failed',NULL,'BUSY','{\"cause\": \"User busy\", \"answered\": 0, \"durationSec\": 28}','2026-08-03 22:57:35.096'),(204,111,4,NULL,NULL,NULL,NULL,'released',NULL,'BUSY','{\"reason\": \"no-recycle-rule\", \"attempts\": 1}','2026-08-03 22:57:35.096'),(205,111,4,34,NULL,NULL,NULL,'selected','BUSY','QUEUED','{\"phone\": \"9818435920\", \"attempt\": 1, \"recycle\": 0}','2026-08-03 22:58:35.139'),(206,111,4,34,100,NULL,3,'dial_started','QUEUED','DIALING','{\"phone\": \"9818435920\", \"source\": \"predictive\", \"attempt\": 1, \"gateway\": \"dinstar\", \"endpoint\": \"gw3\"}','2026-08-03 22:58:35.158'),(207,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-03 22:58:53.928'),(208,111,NULL,NULL,NULL,NULL,NULL,'recovered',NULL,NULL,'{\"reason\": \"stale-in-flight\"}','2026-08-03 23:00:10.013'),(209,111,4,34,100,NULL,3,'failed',NULL,'FAILED','{\"cause\": \"stale\", \"answered\": 0, \"durationSec\": 120}','2026-08-03 23:00:35.195'),(210,111,4,34,NULL,NULL,NULL,'retry_scheduled',NULL,'FAILED','{\"at\": \"2026-08-03T17:31:35.185Z\", \"attempt\": 0, \"delayMin\": 1}','2026-08-03 23:00:35.195'),(211,112,4,34,NULL,NULL,NULL,'selected','NEW','QUEUED','{\"phone\": \"9818435920\", \"attempt\": 1, \"recycle\": 0}','2026-08-03 23:01:35.205'),(212,112,4,34,101,NULL,3,'dial_started','QUEUED','DIALING','{\"phone\": \"9818435920\", \"source\": \"predictive\", \"attempt\": 1, \"gateway\": \"dinstar\", \"endpoint\": \"gw3\"}','2026-08-03 23:01:35.226'),(213,112,NULL,NULL,NULL,NULL,NULL,'recovered',NULL,NULL,'{\"reason\": \"stale-in-flight\"}','2026-08-03 23:03:18.249'),(214,112,4,34,101,NULL,3,'failed',NULL,'FAILED','{\"cause\": \"stale\", \"answered\": 0, \"durationSec\": 120}','2026-08-03 23:03:35.258'),(215,112,4,34,NULL,NULL,NULL,'retry_scheduled',NULL,'FAILED','{\"at\": \"2026-08-03T17:34:35.250Z\", \"attempt\": 1, \"delayMin\": 1}','2026-08-03 23:03:35.259'),(216,112,4,34,NULL,NULL,NULL,'selected','FAILED','QUEUED','{\"phone\": \"9818435920\", \"attempt\": 1, \"recycle\": 0}','2026-08-03 23:04:35.282'),(217,112,4,34,102,NULL,3,'dial_started','QUEUED','DIALING','{\"phone\": \"9818435920\", \"source\": \"predictive\", \"attempt\": 1, \"gateway\": \"dinstar\", \"endpoint\": \"gw3\"}','2026-08-03 23:04:35.303'),(218,112,NULL,NULL,NULL,NULL,NULL,'recovered',NULL,NULL,'{\"reason\": \"stale-in-flight\"}','2026-08-03 23:06:18.331'),(219,112,4,34,102,NULL,3,'failed',NULL,'FAILED','{\"cause\": \"stale\", \"answered\": 0, \"durationSec\": 120}','2026-08-03 23:06:35.345'),(220,112,4,34,NULL,NULL,NULL,'retry_scheduled',NULL,'FAILED','{\"at\": \"2026-08-03T17:37:35.333Z\", \"attempt\": 1, \"delayMin\": 1}','2026-08-03 23:06:35.346'),(221,112,4,34,NULL,NULL,NULL,'selected','FAILED','QUEUED','{\"phone\": \"9818435920\", \"attempt\": 1, \"recycle\": 0}','2026-08-03 23:07:35.362'),(222,112,4,34,103,NULL,3,'dial_started','QUEUED','DIALING','{\"phone\": \"9818435920\", \"source\": \"predictive\", \"attempt\": 1, \"gateway\": \"dinstar\", \"endpoint\": \"gw3\"}','2026-08-03 23:07:35.379'),(223,112,4,34,103,NULL,3,'failed',NULL,'FAILED','{\"cause\": \"stale\", \"answered\": 0, \"durationSec\": 120}','2026-08-03 23:09:35.436'),(224,113,4,35,NULL,NULL,NULL,'selected','NEW','QUEUED','{\"phone\": \"9818435920\", \"attempt\": 1, \"recycle\": 0}','2026-08-03 23:10:35.455'),(225,113,4,35,104,NULL,3,'dial_started','QUEUED','DIALING','{\"phone\": \"9818435920\", \"source\": \"predictive\", \"attempt\": 1, \"gateway\": \"dinstar\", \"endpoint\": \"gw3\"}','2026-08-03 23:10:35.473'),(226,113,4,35,104,NULL,3,'failed',NULL,'NO_ANSWER','{\"cause\": \"Unknown\", \"answered\": 0, \"durationSec\": 30}','2026-08-03 23:11:05.638'),(227,113,4,35,NULL,NULL,NULL,'retry_scheduled',NULL,'NO_ANSWER','{\"at\": \"2026-08-03T17:42:05.632Z\", \"attempt\": 1, \"delayMin\": 1}','2026-08-03 23:11:05.638'),(228,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-03 23:11:59.665'),(229,113,4,35,NULL,NULL,NULL,'selected','NO_ANSWER','QUEUED','{\"phone\": \"9818435920\", \"attempt\": 2, \"recycle\": 1}','2026-08-03 23:12:06.514'),(230,113,4,35,105,NULL,NULL,'retry_attempt',NULL,NULL,'{\"attempt\": 2, \"recycleAttempts\": 0}','2026-08-03 23:12:06.521'),(231,113,4,35,105,NULL,3,'dial_started','QUEUED','DIALING','{\"phone\": \"9818435920\", \"source\": \"predictive\", \"attempt\": 2, \"gateway\": \"dinstar\", \"endpoint\": \"gw3\"}','2026-08-03 23:12:06.530'),(232,113,4,35,105,NULL,3,'failed',NULL,'FAILED','{\"cause\": \"stale\", \"answered\": 0, \"durationSec\": 120}','2026-08-03 23:14:06.573'),(233,114,4,36,NULL,NULL,NULL,'selected','NEW','QUEUED','{\"phone\": \"9818435920\", \"attempt\": 1, \"recycle\": 0}','2026-08-03 23:15:06.610'),(234,114,4,36,106,NULL,3,'dial_started','QUEUED','DIALING','{\"phone\": \"9818435920\", \"source\": \"predictive\", \"attempt\": 1, \"gateway\": \"dinstar\", \"endpoint\": \"gw3\"}','2026-08-03 23:15:06.631'),(235,114,NULL,NULL,NULL,NULL,NULL,'recovered',NULL,NULL,'{\"reason\": \"stale-in-flight\"}','2026-08-03 23:16:48.667'),(236,114,4,36,106,NULL,3,'failed',NULL,'FAILED','{\"cause\": \"stale\", \"answered\": 0, \"durationSec\": 120}','2026-08-03 23:17:06.678'),(237,114,4,36,NULL,NULL,NULL,'retry_scheduled',NULL,'FAILED','{\"at\": \"2026-08-03T17:48:06.669Z\", \"attempt\": 1, \"delayMin\": 1}','2026-08-03 23:17:06.678'),(238,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-04 13:50:58.679'),(239,114,4,36,NULL,NULL,NULL,'selected','FAILED','QUEUED','{\"phone\": \"9818435920\", \"attempt\": 2, \"recycle\": 1}','2026-08-04 13:53:37.648'),(240,114,4,36,108,NULL,NULL,'retry_attempt',NULL,NULL,'{\"attempt\": 2, \"recycleAttempts\": 0}','2026-08-04 13:53:37.760'),(241,114,4,36,108,NULL,3,'dial_started','QUEUED','DIALING','{\"phone\": \"9818435920\", \"source\": \"predictive\", \"attempt\": 2, \"gateway\": \"dinstar\", \"endpoint\": \"gw3\"}','2026-08-04 13:53:37.824'),(242,114,4,36,108,NULL,3,'answered',NULL,NULL,'{\"ringSec\": 16}','2026-08-04 13:53:54.068'),(243,114,4,36,108,23,3,'connected','RINGING','CONNECTED',NULL,'2026-08-04 13:54:03.298'),(244,114,4,NULL,108,23,NULL,'disposition',NULL,NULL,'{\"talkSec\": 6, \"awaiting\": \"agent-wrapup\"}','2026-08-04 13:54:09.536'),(245,114,4,NULL,NULL,NULL,NULL,'retry_scheduled',NULL,'CONNECTED','{\"at\": \"2026-08-04T08:25:21.890Z\", \"attempt\": 2, \"delayMin\": 1}','2026-08-04 13:54:22.942'),(246,114,4,36,108,23,NULL,'disposition','CONNECTED','CONNECTED','{\"disposition\": \"-\", \"durationSec\": 7}','2026-08-04 13:54:22.942'),(247,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-04 14:02:39.666'),(248,114,4,36,NULL,NULL,NULL,'selected','CONNECTED','QUEUED','{\"phone\": \"9818435920\", \"attempt\": 3, \"recycle\": 1}','2026-08-04 14:04:21.754'),(249,114,4,36,109,NULL,NULL,'retry_attempt',NULL,NULL,'{\"attempt\": 3, \"recycleAttempts\": 0}','2026-08-04 14:04:21.768'),(250,114,4,36,109,NULL,3,'dial_started','QUEUED','DIALING','{\"phone\": \"9818435920\", \"source\": \"predictive\", \"attempt\": 3, \"gateway\": \"dinstar\", \"endpoint\": \"gw3\"}','2026-08-04 14:04:21.778'),(251,114,4,36,109,NULL,3,'failed',NULL,'NO_ANSWER','{\"cause\": \"Unknown\", \"answered\": 0, \"durationSec\": 30}','2026-08-04 14:04:51.796'),(252,114,4,36,NULL,NULL,NULL,'retry_scheduled',NULL,'NO_ANSWER','{\"at\": \"2026-08-04T08:35:51.788Z\", \"attempt\": 3, \"delayMin\": 1}','2026-08-04 14:04:51.796'),(253,114,4,36,NULL,NULL,NULL,'selected','NO_ANSWER','QUEUED','{\"phone\": \"9818435920\", \"attempt\": 4, \"recycle\": 1}','2026-08-04 14:05:52.793'),(254,114,4,36,110,NULL,NULL,'retry_attempt',NULL,NULL,'{\"attempt\": 4, \"recycleAttempts\": 0}','2026-08-04 14:05:52.807'),(255,114,4,36,110,NULL,3,'dial_started','QUEUED','DIALING','{\"phone\": \"9818435920\", \"source\": \"predictive\", \"attempt\": 4, \"gateway\": \"dinstar\", \"endpoint\": \"gw3\"}','2026-08-04 14:05:52.815'),(256,114,4,36,110,NULL,3,'answered',NULL,NULL,'{\"ringSec\": 17}','2026-08-04 14:06:09.414'),(257,114,4,36,110,23,3,'connected','RINGING','CONNECTED',NULL,'2026-08-04 14:06:11.827'),(258,114,4,NULL,110,23,NULL,'disposition',NULL,NULL,'{\"talkSec\": 8, \"awaiting\": \"agent-wrapup\"}','2026-08-04 14:06:20.155'),(259,114,4,36,110,23,NULL,'disposition','CONNECTED','CONNECTED','{\"disposition\": \"-\", \"durationSec\": 8}','2026-08-04 14:06:21.787'),(260,114,4,NULL,NULL,NULL,NULL,'retry_scheduled',NULL,'CONNECTED','{\"at\": \"2026-08-04T08:37:21.781Z\", \"attempt\": 4, \"delayMin\": 1}','2026-08-04 14:06:21.787'),(261,114,4,36,NULL,NULL,NULL,'selected','CONNECTED','QUEUED','{\"phone\": \"9818435920\", \"attempt\": 5, \"recycle\": 1}','2026-08-04 14:07:21.834'),(262,114,4,36,111,NULL,NULL,'retry_attempt',NULL,NULL,'{\"attempt\": 5, \"recycleAttempts\": 0}','2026-08-04 14:07:21.847'),(263,114,4,36,111,NULL,3,'dial_started','QUEUED','DIALING','{\"phone\": \"9818435920\", \"source\": \"predictive\", \"attempt\": 5, \"gateway\": \"dinstar\", \"endpoint\": \"gw3\"}','2026-08-04 14:07:21.854'),(264,114,4,36,111,NULL,3,'failed',NULL,'NO_ANSWER','{\"cause\": \"Unknown\", \"answered\": 0, \"durationSec\": 30}','2026-08-04 14:07:51.952'),(265,114,4,36,NULL,NULL,NULL,'retry_scheduled',NULL,'NO_ANSWER','{\"at\": \"2026-08-04T08:38:51.946Z\", \"attempt\": 5, \"delayMin\": 1}','2026-08-04 14:07:51.952'),(266,114,4,36,NULL,NULL,NULL,'selected','NO_ANSWER','QUEUED','{\"phone\": \"9818435920\", \"attempt\": 6, \"recycle\": 1}','2026-08-04 14:08:52.891'),(267,114,4,36,112,NULL,NULL,'retry_attempt',NULL,NULL,'{\"attempt\": 6, \"recycleAttempts\": 0}','2026-08-04 14:08:52.899'),(268,114,4,36,112,NULL,3,'dial_started','QUEUED','DIALING','{\"phone\": \"9818435920\", \"source\": \"predictive\", \"attempt\": 6, \"gateway\": \"dinstar\", \"endpoint\": \"gw3\"}','2026-08-04 14:08:52.906'),(269,114,4,36,112,NULL,3,'answered',NULL,NULL,'{\"ringSec\": 14}','2026-08-04 14:09:07.018'),(270,114,4,36,112,23,3,'connected','RINGING','CONNECTED',NULL,'2026-08-04 14:09:08.097'),(271,114,4,NULL,112,23,NULL,'disposition',NULL,NULL,'{\"talkSec\": 8, \"awaiting\": \"agent-wrapup\"}','2026-08-04 14:09:15.902'),(272,114,4,36,112,23,NULL,'disposition','CONNECTED','CONNECTED','{\"disposition\": \"-\", \"durationSec\": 8}','2026-08-04 14:09:18.110'),(273,114,4,NULL,NULL,NULL,NULL,'retry_scheduled',NULL,'CONNECTED','{\"at\": \"2026-08-04T08:40:18.104Z\", \"attempt\": 6, \"delayMin\": 1}','2026-08-04 14:09:18.110'),(274,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-04 14:57:11.862'),(275,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-04 14:58:16.879'),(276,NULL,NULL,NULL,NULL,NULL,3,'gateway_down',NULL,NULL,'{\"name\": \"dinstar\", \"state\": \"offline\", \"endpoint\": \"gw3\"}','2026-08-05 10:27:41.260'),(277,NULL,NULL,NULL,NULL,NULL,3,'gateway_up',NULL,NULL,'{\"name\": \"dinstar\", \"state\": \"online\", \"endpoint\": \"gw3\"}','2026-08-05 10:28:21.262'),(278,NULL,NULL,NULL,NULL,NULL,3,'gateway_down',NULL,NULL,'{\"name\": \"dinstar\", \"state\": \"offline\", \"endpoint\": \"gw3\"}','2026-08-05 10:34:21.269'),(279,NULL,NULL,NULL,NULL,NULL,3,'gateway_up',NULL,NULL,'{\"name\": \"dinstar\", \"state\": \"online\", \"endpoint\": \"gw3\"}','2026-08-05 10:35:21.271'),(280,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-05 12:09:29.065'),(281,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-05 12:26:23.810'),(282,115,4,37,NULL,NULL,NULL,'selected','NEW','QUEUED','{\"phone\": \"9818435920\", \"attempt\": 1, \"recycle\": 0}','2026-08-05 12:28:37.887'),(283,115,4,37,114,NULL,3,'dial_started','QUEUED','DIALING','{\"phone\": \"9818435920\", \"source\": \"predictive\", \"attempt\": 1, \"gateway\": \"dinstar\", \"endpoint\": \"gw3\"}','2026-08-05 12:28:38.398'),(284,115,4,37,114,NULL,3,'failed',NULL,'FAILED','{\"cause\": \"Circuit/channel congestion\", \"answered\": 0, \"durationSec\": 1}','2026-08-05 12:28:38.718'),(285,115,4,37,NULL,NULL,NULL,'retry_scheduled',NULL,'FAILED','{\"at\": \"2026-08-05T06:59:37.979Z\", \"attempt\": 1, \"delayMin\": 1}','2026-08-05 12:28:38.755'),(286,115,4,37,NULL,NULL,NULL,'selected','FAILED','QUEUED','{\"phone\": \"9818435920\", \"attempt\": 1, \"recycle\": 0}','2026-08-05 12:29:38.836'),(287,115,4,37,115,NULL,3,'dial_started','QUEUED','DIALING','{\"phone\": \"9818435920\", \"source\": \"predictive\", \"attempt\": 1, \"gateway\": \"dinstar\", \"endpoint\": \"gw3\"}','2026-08-05 12:29:39.003'),(288,115,4,37,115,NULL,3,'failed',NULL,'FAILED','{\"cause\": \"Circuit/channel congestion\", \"answered\": 0, \"durationSec\": 0}','2026-08-05 12:29:39.094'),(289,115,4,37,NULL,NULL,NULL,'retry_scheduled',NULL,'FAILED','{\"at\": \"2026-08-05T07:00:38.521Z\", \"attempt\": 1, \"delayMin\": 1}','2026-08-05 12:29:39.094'),(290,115,4,37,NULL,NULL,NULL,'selected','FAILED','QUEUED','{\"phone\": \"9818435920\", \"attempt\": 2, \"recycle\": 1}','2026-08-05 12:30:39.333'),(291,115,4,37,116,NULL,NULL,'retry_attempt',NULL,NULL,'{\"attempt\": 2, \"recycleAttempts\": 0}','2026-08-05 12:30:39.395'),(292,115,4,37,116,NULL,3,'dial_started','QUEUED','DIALING','{\"phone\": \"9818435920\", \"source\": \"predictive\", \"attempt\": 2, \"gateway\": \"dinstar\", \"endpoint\": \"gw3\"}','2026-08-05 12:30:39.461'),(293,115,4,37,116,NULL,3,'failed',NULL,'FAILED','{\"cause\": \"Circuit/channel congestion\", \"answered\": 0, \"durationSec\": 0}','2026-08-05 12:30:39.529'),(294,115,4,37,NULL,NULL,NULL,'retry_scheduled',NULL,'FAILED','{\"at\": \"2026-08-05T07:01:38.970Z\", \"attempt\": 2, \"delayMin\": 1}','2026-08-05 12:30:39.529'),(295,115,4,37,NULL,NULL,NULL,'selected','FAILED','QUEUED','{\"phone\": \"9818435920\", \"attempt\": 3, \"recycle\": 1}','2026-08-05 12:40:44.002'),(296,115,4,37,117,NULL,NULL,'retry_attempt',NULL,NULL,'{\"attempt\": 3, \"recycleAttempts\": 1}','2026-08-05 12:40:44.049'),(297,115,4,37,117,NULL,3,'dial_started','QUEUED','DIALING','{\"phone\": \"9818435920\", \"source\": \"predictive\", \"attempt\": 3, \"gateway\": \"dinstar\", \"endpoint\": \"gw3\"}','2026-08-05 12:40:44.101'),(298,115,4,37,117,NULL,3,'answered',NULL,NULL,'{\"ringSec\": 14}','2026-08-05 12:40:58.065'),(299,115,4,37,117,NULL,NULL,'abandoned',NULL,NULL,'{\"reason\": \"no-ready-agent\", \"abandonPct\": \"0.0\"}','2026-08-05 12:40:58.206'),(300,115,4,37,117,NULL,3,'failed',NULL,'CANCELLED','{\"cause\": \"abandoned\", \"answered\": 1, \"durationSec\": 14}','2026-08-05 12:40:58.429'),(301,115,4,NULL,NULL,NULL,NULL,'released',NULL,'CANCELLED','{\"reason\": \"no-recycle-rule\", \"attempts\": 3}','2026-08-05 12:40:58.429'),(302,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-05 13:02:37.900'),(303,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-05 18:38:24.864'),(304,115,4,37,NULL,NULL,NULL,'selected','CANCELLED','QUEUED','{\"phone\": \"9818435920\", \"attempt\": 1, \"recycle\": 0}','2026-08-05 18:40:42.624'),(305,115,4,37,120,NULL,3,'dial_started','QUEUED','DIALING','{\"phone\": \"9818435920\", \"source\": \"predictive\", \"attempt\": 1, \"gateway\": \"dinstar\", \"endpoint\": \"gw3\"}','2026-08-05 18:40:42.986'),(306,115,4,37,120,NULL,3,'answered',NULL,NULL,'{\"ringSec\": 15}','2026-08-05 18:40:58.133'),(307,115,4,37,120,23,3,'connected','RINGING','CONNECTED',NULL,'2026-08-05 18:41:01.954'),(308,115,4,NULL,120,23,NULL,'disposition',NULL,NULL,'{\"talkSec\": 27, \"awaiting\": \"agent-wrapup\"}','2026-08-05 18:41:28.982'),(309,115,4,37,120,23,NULL,'disposition','CONNECTED','CONNECTED','{\"disposition\": \"-\", \"durationSec\": 27}','2026-08-05 18:41:48.858'),(310,115,4,NULL,NULL,NULL,NULL,'retry_scheduled',NULL,'CONNECTED','{\"at\": \"2026-08-05T13:12:48.152Z\", \"attempt\": 1, \"delayMin\": 1}','2026-08-05 18:41:48.860'),(311,115,4,37,NULL,NULL,NULL,'selected','CONNECTED','QUEUED','{\"phone\": \"9818435920\", \"attempt\": 2, \"recycle\": 1}','2026-08-05 18:42:48.186'),(312,115,4,37,122,NULL,NULL,'retry_attempt',NULL,NULL,'{\"attempt\": 2, \"recycleAttempts\": 0}','2026-08-05 18:42:48.334'),(313,115,4,37,122,NULL,3,'dial_started','QUEUED','DIALING','{\"phone\": \"9818435920\", \"source\": \"predictive\", \"attempt\": 2, \"gateway\": \"dinstar\", \"endpoint\": \"gw3\"}','2026-08-05 18:42:48.382'),(314,115,4,37,122,NULL,3,'answered',NULL,NULL,'{\"ringSec\": 14}','2026-08-05 18:43:02.811'),(315,115,4,37,122,23,3,'connected','RINGING','CONNECTED',NULL,'2026-08-05 18:43:04.594'),(316,115,4,NULL,122,23,NULL,'disposition',NULL,NULL,'{\"talkSec\": 7, \"awaiting\": \"agent-wrapup\"}','2026-08-05 18:43:11.288'),(317,115,NULL,NULL,NULL,NULL,NULL,'recovered',NULL,NULL,'{\"reason\": \"stale-in-flight\"}','2026-08-05 19:13:22.545'),(318,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-05 19:42:22.155'),(319,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-05 19:43:47.254'),(320,115,4,37,NULL,NULL,NULL,'selected','CANCELLED','QUEUED','{\"phone\": \"9818435920\", \"attempt\": 1, \"recycle\": 0}','2026-08-05 19:45:33.451'),(321,115,4,37,123,NULL,3,'dial_started','QUEUED','DIALING','{\"phone\": \"9818435920\", \"source\": \"predictive\", \"attempt\": 1, \"gateway\": \"dinstar\", \"endpoint\": \"gw3\"}','2026-08-05 19:45:33.713'),(322,115,4,37,123,NULL,3,'answered',NULL,NULL,'{\"ringSec\": 16}','2026-08-05 19:45:50.188'),(323,115,4,37,123,23,3,'connected','RINGING','CONNECTED',NULL,'2026-08-05 19:45:53.269'),(324,115,4,NULL,123,23,NULL,'disposition',NULL,NULL,'{\"talkSec\": 15, \"awaiting\": \"agent-wrapup\"}','2026-08-05 19:46:08.507'),(325,115,4,37,123,23,NULL,'disposition',NULL,'COMPLETED','{\"rule\": \"rule:2\", \"scope\": \"LOAN\", \"action\": \"CLOSE_LEAD\", \"reason\": \"SETTLEMENT_PAID\", \"disposition\": \"PAID\", \"durationSec\": 15}','2026-08-05 19:49:13.426'),(326,115,4,NULL,NULL,NULL,NULL,'completed',NULL,'COMPLETED','{\"scope\": \"LOAN\", \"action\": \"CLOSE_LEAD\", \"leadsClosed\": 1}','2026-08-05 19:49:13.427'),(327,115,4,37,NULL,NULL,NULL,'selected','COMPLETED','QUEUED','{\"phone\": \"9818435920\", \"attempt\": 1, \"recycle\": 0}','2026-08-05 19:51:06.171'),(328,115,4,37,124,NULL,3,'dial_started','QUEUED','DIALING','{\"phone\": \"9818435920\", \"source\": \"predictive\", \"attempt\": 1, \"gateway\": \"dinstar\", \"endpoint\": \"gw3\"}','2026-08-05 19:51:06.319'),(329,115,4,37,124,NULL,3,'failed',NULL,'BUSY','{\"cause\": \"User busy\", \"action\": \"NO_RETRY\", \"reason\": \"BUSY\", \"answered\": 0, \"disposition\": \"SYS_NO_CONTACT\", \"durationSec\": 10}','2026-08-05 19:51:16.377'),(330,115,4,NULL,NULL,NULL,NULL,'released',NULL,'BUSY','{\"rule\": \"rule:74\", \"scope\": \"LEAD\", \"action\": \"NO_RETRY\"}','2026-08-05 19:51:16.377'),(331,116,26,38,NULL,NULL,NULL,'selected','NEW','QUEUED','{\"phone\": \"9818435920\", \"attempt\": 1, \"recycle\": 0}','2026-08-05 20:07:50.032'),(332,116,26,38,125,NULL,3,'dial_started','QUEUED','DIALING','{\"phone\": \"9818435920\", \"source\": \"ratio\", \"attempt\": 1, \"gateway\": \"dinstar\", \"endpoint\": \"gw3\"}','2026-08-05 20:07:50.222'),(333,116,26,38,125,NULL,3,'answered',NULL,NULL,'{\"ringSec\": 16}','2026-08-05 20:08:06.022'),(334,116,26,38,125,23,3,'connected','RINGING','CONNECTED',NULL,'2026-08-05 20:08:08.068'),(335,116,26,NULL,125,23,NULL,'disposition',NULL,NULL,'{\"talkSec\": 7, \"awaiting\": \"agent-wrapup\"}','2026-08-05 20:08:15.248'),(336,116,26,NULL,NULL,NULL,NULL,'completed',NULL,'COMPLETED','{\"scope\": \"LOAN\", \"action\": \"CLOSE_LEAD\", \"leadsClosed\": 1}','2026-08-05 20:09:23.613'),(337,116,26,38,125,23,NULL,'disposition',NULL,'COMPLETED','{\"rule\": \"rule:24\", \"scope\": \"LOAN\", \"action\": \"CLOSE_LEAD\", \"reason\": \"PFI_PERMANENT\", \"disposition\": \"FI\", \"durationSec\": 7}','2026-08-05 20:09:23.613'),(338,116,3,38,NULL,23,NULL,'reserved','COMPLETED','QUEUED','{\"phone\": \"9818435920\", \"source\": \"manual\", \"attempt\": 1, \"recycle\": 0}','2026-08-05 20:28:11.542'),(339,116,3,38,NULL,23,NULL,'reserved','COMPLETED','QUEUED','{\"phone\": \"9818435920\", \"source\": \"manual\", \"attempt\": 1, \"recycle\": 0}','2026-08-05 20:35:19.570'),(340,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-05 20:40:09.566'),(341,116,3,38,NULL,23,NULL,'reserved','COMPLETED','QUEUED','{\"phone\": \"9818435920\", \"source\": \"manual\", \"attempt\": 1, \"recycle\": 0}','2026-08-05 20:40:39.279'),(342,116,3,38,129,23,3,'dial_started',NULL,'DIALING','{\"phone\": \"9818435920\", \"source\": \"manual\", \"attempt\": 1, \"gateway\": \"dinstar\"}','2026-08-05 20:41:35.580'),(343,116,3,NULL,129,23,3,'failed',NULL,'BUSY','{\"cause\": \"User busy\", \"source\": \"manual\"}','2026-08-05 20:41:57.806'),(344,116,3,38,129,23,NULL,'disposition',NULL,'DNC','{\"rule\": \"rule:70\", \"scope\": \"NUMBER\", \"action\": \"DNC\", \"reason\": \"DO_NOT_CALL\", \"disposition\": \"DNC\", \"durationSec\": 22}','2026-08-05 20:42:20.041'),(345,116,3,NULL,NULL,NULL,NULL,'completed',NULL,'DNC','{\"scope\": \"NUMBER\", \"action\": \"DNC\", \"leadsClosed\": 1, \"numbersBlocked\": 1}','2026-08-05 20:42:20.058'),(346,40,3,10,NULL,23,NULL,'reserved','CONNECTED','QUEUED','{\"phone\": \"9818465920\", \"source\": \"manual\", \"attempt\": 8, \"recycle\": 1}','2026-08-05 20:47:47.653'),(347,40,3,10,NULL,23,NULL,'released',NULL,NULL,'{\"reason\": \"skip\", \"source\": \"manual\"}','2026-08-05 20:47:53.197'),(348,71,3,10,NULL,23,NULL,'reserved','NEW','QUEUED','{\"phone\": \"9818435720\", \"source\": \"manual\", \"attempt\": 1, \"recycle\": 0}','2026-08-05 20:47:53.373'),(349,71,3,10,NULL,23,NULL,'released',NULL,NULL,'{\"reason\": \"skip\", \"source\": \"manual\"}','2026-08-05 20:47:54.400'),(350,40,3,10,NULL,23,NULL,'reserved','CONNECTED','QUEUED','{\"phone\": \"9818465920\", \"source\": \"manual\", \"attempt\": 8, \"recycle\": 1}','2026-08-05 20:48:02.196'),(351,40,3,10,NULL,23,NULL,'released',NULL,NULL,'{\"reason\": \"skip\", \"source\": \"manual\"}','2026-08-05 20:48:03.741'),(352,71,3,10,NULL,23,NULL,'reserved','NEW','QUEUED','{\"phone\": \"9818435720\", \"source\": \"manual\", \"attempt\": 1, \"recycle\": 0}','2026-08-05 20:48:03.827'),(353,71,3,10,NULL,23,NULL,'released',NULL,NULL,'{\"reason\": \"skip\", \"source\": \"manual\"}','2026-08-05 20:48:05.067'),(354,40,3,10,NULL,23,NULL,'reserved','CONNECTED','QUEUED','{\"phone\": \"9818465920\", \"source\": \"manual\", \"attempt\": 8, \"recycle\": 1}','2026-08-05 20:49:49.395'),(355,40,3,10,NULL,23,NULL,'released',NULL,NULL,'{\"reason\": \"skip\", \"source\": \"manual\"}','2026-08-05 20:49:52.121'),(356,71,3,10,NULL,23,NULL,'reserved','NEW','QUEUED','{\"phone\": \"9818435720\", \"source\": \"manual\", \"attempt\": 1, \"recycle\": 0}','2026-08-05 20:49:52.179'),(357,71,3,10,NULL,23,NULL,'released',NULL,NULL,'{\"reason\": \"skip\", \"source\": \"manual\"}','2026-08-05 20:49:53.280'),(358,40,3,10,NULL,23,NULL,'reserved','CONNECTED','QUEUED','{\"phone\": \"9818465920\", \"source\": \"manual\", \"attempt\": 8, \"recycle\": 1}','2026-08-05 21:28:52.265'),(359,40,3,10,NULL,23,NULL,'released',NULL,NULL,'{\"reason\": \"skip\", \"source\": \"manual\"}','2026-08-05 21:29:03.437'),(360,71,3,10,NULL,23,NULL,'reserved','NEW','QUEUED','{\"phone\": \"9818435720\", \"source\": \"manual\", \"attempt\": 1, \"recycle\": 0}','2026-08-05 21:29:03.696'),(361,71,3,10,NULL,23,NULL,'released',NULL,NULL,'{\"reason\": \"skip\", \"source\": \"manual\"}','2026-08-05 21:29:04.786'),(362,40,3,10,NULL,23,NULL,'reserved','CONNECTED','QUEUED','{\"phone\": \"9818465920\", \"source\": \"manual\", \"attempt\": 8, \"recycle\": 1}','2026-08-05 21:36:57.120'),(363,40,3,10,NULL,23,NULL,'released',NULL,NULL,'{\"reason\": \"skip\", \"source\": \"manual\"}','2026-08-05 21:37:15.792'),(364,71,3,10,NULL,23,NULL,'reserved','NEW','QUEUED','{\"phone\": \"9818435720\", \"source\": \"manual\", \"attempt\": 1, \"recycle\": 0}','2026-08-05 21:37:15.875'),(365,71,3,10,NULL,23,NULL,'released',NULL,NULL,'{\"reason\": \"skip\", \"source\": \"manual\"}','2026-08-05 21:37:17.528'),(366,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-05 21:46:07.576'),(367,40,3,10,NULL,23,NULL,'reserved','CONNECTED','QUEUED','{\"phone\": \"9818465920\", \"source\": \"manual\", \"attempt\": 8, \"recycle\": 1}','2026-08-05 21:51:43.265'),(368,40,3,10,NULL,23,NULL,'released',NULL,NULL,'{\"reason\": \"skip\", \"source\": \"manual\"}','2026-08-05 21:51:47.611'),(369,71,3,10,NULL,23,NULL,'reserved','NEW','QUEUED','{\"phone\": \"9818435720\", \"source\": \"manual\", \"attempt\": 1, \"recycle\": 0}','2026-08-05 21:51:47.769'),(370,71,3,10,NULL,23,NULL,'released',NULL,NULL,'{\"reason\": \"skip\", \"source\": \"manual\"}','2026-08-05 21:51:48.894'),(371,NULL,NULL,NULL,NULL,NULL,3,'gateway_down',NULL,NULL,'{\"name\": \"dinstar\", \"state\": \"offline\", \"endpoint\": \"gw3\"}','2026-08-06 10:28:43.218'),(372,NULL,NULL,NULL,NULL,NULL,3,'gateway_down',NULL,NULL,'{\"name\": \"dinstar\", \"state\": \"offline\", \"endpoint\": \"gw3\"}','2026-08-06 12:05:00.028'),(373,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-06 12:05:00.029'),(374,NULL,NULL,NULL,NULL,NULL,3,'gateway_up',NULL,NULL,'{\"name\": \"dinstar\", \"state\": \"online\", \"endpoint\": \"gw3\"}','2026-08-06 12:05:19.986'),(375,NULL,NULL,NULL,NULL,NULL,3,'gateway_down',NULL,NULL,'{\"name\": \"dinstar\", \"state\": \"offline\", \"endpoint\": \"gw3\"}','2026-08-11 06:46:49.519'),(376,NULL,NULL,NULL,NULL,NULL,3,'gateway_up',NULL,NULL,'{\"name\": \"dinstar\", \"state\": \"online\", \"endpoint\": \"gw3\"}','2026-08-11 06:47:09.520'),(377,NULL,NULL,NULL,NULL,NULL,3,'gateway_down',NULL,NULL,'{\"name\": \"dinstar\", \"state\": \"offline\", \"endpoint\": \"gw3\"}','2026-08-12 15:12:12.180'),(378,NULL,NULL,NULL,NULL,NULL,3,'gateway_up',NULL,NULL,'{\"name\": \"dinstar\", \"state\": \"online\", \"endpoint\": \"gw3\"}','2026-08-12 15:12:32.180'),(379,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-14 15:49:12.504'),(380,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-14 15:53:47.237'),(381,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-14 16:02:53.549'),(382,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-14 16:21:08.178'),(383,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-14 16:23:05.105'),(384,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-14 16:24:02.082'),(385,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-14 16:27:22.940'),(386,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-14 16:34:53.221'),(387,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-14 16:38:20.066'),(388,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-14 16:40:06.335'),(389,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-14 16:41:09.760'),(390,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-14 16:42:56.230'),(391,NULL,NULL,NULL,NULL,NULL,4,'gateway_down',NULL,NULL,'{\"name\": \"fake to check\", \"state\": \"offline\", \"endpoint\": \"gw4\"}','2026-08-14 16:46:55.097'),(392,NULL,NULL,NULL,NULL,NULL,3,'gateway_down',NULL,NULL,'{\"name\": \"dinstar\", \"state\": \"offline\", \"endpoint\": \"gw3\"}','2026-08-14 17:55:56.468'),(393,NULL,NULL,NULL,NULL,NULL,3,'gateway_up',NULL,NULL,'{\"name\": \"dinstar\", \"state\": \"online\", \"endpoint\": \"gw3\"}','2026-08-14 17:56:36.469');
/*!40000 ALTER TABLE `dialer_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `disposition_reasons`
--

DROP TABLE IF EXISTS `disposition_reasons`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `disposition_reasons` (
  `id` int NOT NULL AUTO_INCREMENT,
  `disposition_id` int NOT NULL,
  `code` varchar(64) NOT NULL,
  `label` varchar(180) NOT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `requires_payment` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Agent must enter amount / date / mode (the old "$" prefix convention)',
  `requires_followup` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Agent must pick a follow-up date/time before saving',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_reason_code` (`disposition_id`,`code`),
  KEY `idx_reason_disposition` (`disposition_id`,`active`,`sort_order`),
  CONSTRAINT `fk_reason_disposition` FOREIGN KEY (`disposition_id`) REFERENCES `dispositions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=57 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `disposition_reasons`
--

LOCK TABLES `disposition_reasons` WRITE;
/*!40000 ALTER TABLE `disposition_reasons` DISABLE KEYS */;
INSERT INTO `disposition_reasons` VALUES (1,1,'FULL_PAID','Full Paid',10,1,0,0,'2026-08-05 19:42:37'),(2,1,'SETTLEMENT_PAID','Settlement Paid',20,1,0,0,'2026-08-05 19:42:37'),(3,1,'PARTIAL_PAID','Partial Paid',30,1,0,0,'2026-08-05 19:42:37'),(4,2,'ON_WAY_BRANCH','On the way (Branch)',10,1,0,0,'2026-08-05 19:42:37'),(5,2,'ON_WAY_BANK','On the way (Bank)',20,1,0,0,'2026-08-05 19:42:37'),(6,2,'ONLINE_PAYMENT','Customer doing online Payment',30,1,0,0,'2026-08-05 19:42:37'),(7,3,'READY_TO_PAY','Customer ready to pay',10,1,1,1,'2026-08-05 19:42:37'),(8,4,'FUTURE_PTP','Future PTP',10,1,1,1,'2026-08-05 19:42:37'),(9,5,'READY_SETTLEMENT','Customer ready to pay settlement',10,1,1,1,'2026-08-05 19:42:38'),(10,6,'ASKING_DAYS','Excuse - asking days for payment',10,1,0,0,'2026-08-05 19:42:38'),(11,6,'EMERGENCY','Emergency Reason / Death / Accident',20,1,0,0,'2026-08-05 19:42:38'),(12,7,'CUSTOMER_EMERGENCY','Customer in Emergency',10,1,0,0,'2026-08-05 19:42:38'),(13,7,'CUSTOMER_BUSY','Call back later',20,1,0,1,'2026-08-05 19:42:38'),(14,7,'OUT_OF_STATION','Out of station',30,1,0,0,'2026-08-05 19:42:38'),(15,7,'OTHER','Other',40,1,0,0,'2026-08-05 19:42:38'),(16,7,'STATEMENT_VERIFICATION','Statement verification',50,1,0,0,'2026-08-05 19:42:38'),(17,8,'PFI_PERMANENT','PFI-Permanent - Unemployed / Out of job',10,1,0,0,'2026-08-05 19:42:38'),(18,8,'SFI_SHORT_TERM','SFI-Short Term - Business Issue',20,1,0,0,'2026-08-05 19:42:38'),(19,8,'VEHICLE_VIABILITY','Vehicle Viability / EMI Affordability',30,1,0,0,'2026-08-05 19:42:38'),(20,9,'CUACC','CUACC-Customer Met with Accident',10,1,0,0,'2026-08-05 19:42:39'),(21,9,'VEHAC','VEHAC-Vehicle Met with Accident',20,1,0,0,'2026-08-05 19:42:39'),(22,9,'MEDIS','MEDIS-Medical Issue',30,1,0,0,'2026-08-05 19:42:39'),(23,9,'FMEXP','FMEXP-Death of Family Member',40,1,0,0,'2026-08-05 19:42:39'),(24,10,'NORC','NORC-RC Copy not Received',10,1,0,0,'2026-08-05 19:42:39'),(25,10,'TISSU','TISSU-Technical Issue in Vehicle',20,1,0,0,'2026-08-05 19:42:39'),(26,10,'EMIDP','EMIDP-EMI or DP Issue',30,1,0,0,'2026-08-05 19:42:39'),(27,11,'RINGING','Ringing',10,1,0,0,'2026-08-05 19:42:39'),(28,11,'NOT_REACHABLE','Not Reachable',20,1,0,0,'2026-08-05 19:42:39'),(29,11,'SWITCH_OFF','Switch off',30,1,0,0,'2026-08-05 19:42:40'),(30,11,'NUMBER_BUSY','Number busy',40,1,0,0,'2026-08-05 19:42:40'),(31,11,'BEEP_SILENCE','Beep Silence',50,1,0,0,'2026-08-05 19:42:40'),(32,11,'NO_VOICE','No voice / Voice issue',60,1,0,0,'2026-08-05 19:42:40'),(33,12,'MIGR','MIGR-Customer Migrated / Shift',10,1,0,0,'2026-08-05 19:42:40'),(34,12,'CUNA','CUNA-Not Available at visit place',20,1,0,0,'2026-08-05 19:42:40'),(35,12,'FRAUD','FRAUD-Fraud Case',30,1,0,0,'2026-08-05 19:42:40'),(36,13,'LEFT_MESSAGE','Left Message',10,1,0,0,'2026-08-05 19:42:40'),(37,14,'LANGUAGE_PROBLEM','Language Problem',10,1,0,0,'2026-08-05 19:42:40'),(38,15,'LEGAL_NOTICE','Legal Notice',10,1,0,0,'2026-08-05 19:42:40'),(39,16,'PICK_VEHICLE','Pick the Vehicle',10,1,0,0,'2026-08-05 19:42:40'),(40,17,'INVALID_NUMBER','Wrong Number',10,1,0,0,'2026-08-05 19:42:41'),(41,18,'INTENTIONAL_DEFAULTER','Intentional Defaulter',10,1,0,0,'2026-08-05 19:42:41'),(42,19,'POLICE_CUSTODY','Vehicle under police custody',10,1,0,0,'2026-08-05 19:42:41'),(43,20,'WITH_DEALER','Vehicle with dealer',10,1,0,0,'2026-08-05 19:42:41'),(44,21,'CALL_DROP','Call drop',10,1,0,0,'2026-08-05 19:42:41'),(45,22,'VEHICLE_REPO','Vehicle Repo',10,1,0,0,'2026-08-05 19:42:41'),(46,23,'ACCOUNT_CLOSE','Account Close',10,1,0,0,'2026-08-05 19:42:41'),(47,24,'DO_NOT_CALL','Customer asked not to be called',10,1,0,0,'2026-08-05 19:42:41'),(48,24,'LEGAL_REQUEST','Legal / regulator request',20,1,0,0,'2026-08-05 19:42:41'),(49,25,'NO_ANSWER','Customer did not answer',10,1,0,0,'2026-08-05 19:42:41'),(50,25,'BUSY','Line busy',20,1,0,0,'2026-08-05 19:42:42'),(51,25,'VOICEMAIL','Answering machine',30,1,0,0,'2026-08-05 19:42:42'),(52,25,'FAILED','Network / gateway failure',40,1,0,0,'2026-08-05 19:42:42'),(53,25,'ABANDONED','Answered but no agent was free',50,1,0,0,'2026-08-05 19:42:42'),(54,25,'CANCELLED','Attempt cancelled before an agent joined',60,1,0,0,'2026-08-05 19:42:42'),(55,26,'INVALID_NUMBER','Carrier reports the number is invalid',10,1,0,0,'2026-08-05 19:42:42'),(56,27,'AGENT_TIMEOUT','Agent never saved a wrap-up',10,1,0,0,'2026-08-05 19:42:42');
/*!40000 ALTER TABLE `disposition_reasons` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `disposition_rules`
--

DROP TABLE IF EXISTS `disposition_rules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `disposition_rules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `disposition_id` int NOT NULL,
  `reason_id` int NOT NULL DEFAULT '0' COMMENT '0 = applies to the whole disposition',
  `campaign_id` int NOT NULL DEFAULT '0' COMMENT '0 = global rule; else overrides for that campaign',
  `action` enum('RETRY','CALLBACK','CLOSE_LEAD','DNC','BLOCK_NUMBER','NEXT_NUMBER','NEXT_LOAN','NO_RETRY') NOT NULL,
  `scope` enum('ATTEMPT','NUMBER','LEAD','LOAN') NOT NULL DEFAULT 'LEAD' COMMENT 'What the action applies to: this attempt, this phone number, this lead, or every lead of the loan account',
  `retry_delay_min` int DEFAULT NULL COMMENT 'RETRY/CALLBACK: minutes until the lead may dial again. NULL = fall back to the campaign recycle rule',
  `max_attempts` int DEFAULT NULL COMMENT 'RETRY: attempts allowed on this outcome. NULL = fall back to the campaign recycle rule',
  `callback_required` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'The agent must supply the callback time; the lead is held until it',
  `lead_status` varchar(32) DEFAULT NULL COMMENT 'Status parked on the lead for reporting. NULL = keep the technical status',
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_rule` (`disposition_id`,`reason_id`,`campaign_id`),
  KEY `idx_rule_lookup` (`disposition_id`,`reason_id`,`campaign_id`,`active`),
  CONSTRAINT `fk_rule_disposition` FOREIGN KEY (`disposition_id`) REFERENCES `dispositions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=84 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `disposition_rules`
--

LOCK TABLES `disposition_rules` WRITE;
/*!40000 ALTER TABLE `disposition_rules` DISABLE KEYS */;
INSERT INTO `disposition_rules` VALUES (1,1,1,0,'CLOSE_LEAD','LOAN',NULL,NULL,0,'COMPLETED',1,'2026-08-05 19:42:37'),(2,1,2,0,'CLOSE_LEAD','LOAN',NULL,NULL,0,'COMPLETED',1,'2026-08-05 19:42:37'),(3,1,3,0,'CALLBACK','LEAD',10080,NULL,0,'CALLBACK',1,'2026-08-05 19:42:37'),(4,1,0,0,'CLOSE_LEAD','LOAN',NULL,NULL,0,'COMPLETED',1,'2026-08-05 19:42:37'),(5,2,4,0,'CALLBACK','LEAD',1440,NULL,0,'CALLBACK',1,'2026-08-05 19:42:37'),(6,2,5,0,'CALLBACK','LEAD',1440,NULL,0,'CALLBACK',1,'2026-08-05 19:42:37'),(7,2,6,0,'CALLBACK','LEAD',720,NULL,0,'CALLBACK',1,'2026-08-05 19:42:37'),(8,2,0,0,'CALLBACK','LEAD',1440,NULL,0,'CALLBACK',1,'2026-08-05 19:42:37'),(9,3,7,0,'CALLBACK','LEAD',NULL,NULL,1,'CALLBACK',1,'2026-08-05 19:42:37'),(10,3,0,0,'CALLBACK','LEAD',NULL,NULL,1,'CALLBACK',1,'2026-08-05 19:42:37'),(11,4,8,0,'CALLBACK','LEAD',NULL,NULL,1,'CALLBACK',1,'2026-08-05 19:42:38'),(12,4,0,0,'CALLBACK','LEAD',NULL,NULL,1,'CALLBACK',1,'2026-08-05 19:42:38'),(13,5,9,0,'CALLBACK','LEAD',NULL,NULL,1,'CALLBACK',1,'2026-08-05 19:42:38'),(14,5,0,0,'CALLBACK','LEAD',NULL,NULL,1,'CALLBACK',1,'2026-08-05 19:42:38'),(15,6,10,0,'CALLBACK','LEAD',4320,NULL,0,'CALLBACK',1,'2026-08-05 19:42:38'),(16,6,11,0,'RETRY','LEAD',10080,2,0,NULL,1,'2026-08-05 19:42:38'),(17,6,0,0,'CALLBACK','LEAD',4320,NULL,0,'CALLBACK',1,'2026-08-05 19:42:38'),(18,7,12,0,'CALLBACK','LEAD',1440,NULL,0,'CALLBACK',1,'2026-08-05 19:42:38'),(19,7,13,0,'CALLBACK','LEAD',NULL,NULL,1,'CALLBACK',1,'2026-08-05 19:42:38'),(20,7,14,0,'CALLBACK','LEAD',4320,NULL,0,'CALLBACK',1,'2026-08-05 19:42:38'),(21,7,15,0,'CALLBACK','LEAD',1440,NULL,0,'CALLBACK',1,'2026-08-05 19:42:38'),(22,7,16,0,'CALLBACK','LEAD',1440,NULL,0,'CALLBACK',1,'2026-08-05 19:42:38'),(23,7,0,0,'CALLBACK','LEAD',1440,NULL,0,'CALLBACK',1,'2026-08-05 19:42:38'),(24,8,17,0,'CLOSE_LEAD','LOAN',NULL,NULL,0,'COMPLETED',1,'2026-08-05 19:42:38'),(25,8,18,0,'RETRY','LEAD',20160,3,0,NULL,1,'2026-08-05 19:42:38'),(26,8,19,0,'RETRY','LEAD',10080,3,0,NULL,1,'2026-08-05 19:42:39'),(27,8,0,0,'CLOSE_LEAD','LOAN',NULL,NULL,0,'COMPLETED',1,'2026-08-05 19:42:39'),(28,9,20,0,'RETRY','LEAD',20160,2,0,NULL,1,'2026-08-05 19:42:39'),(29,9,21,0,'RETRY','LEAD',20160,2,0,NULL,1,'2026-08-05 19:42:39'),(30,9,22,0,'RETRY','LEAD',20160,2,0,NULL,1,'2026-08-05 19:42:39'),(31,9,23,0,'NO_RETRY','LEAD',NULL,NULL,0,NULL,1,'2026-08-05 19:42:39'),(32,9,0,0,'RETRY','LEAD',20160,2,0,NULL,1,'2026-08-05 19:42:39'),(33,10,24,0,'RETRY','LEAD',10080,3,0,NULL,1,'2026-08-05 19:42:39'),(34,10,25,0,'RETRY','LEAD',10080,3,0,NULL,1,'2026-08-05 19:42:39'),(35,10,26,0,'RETRY','LEAD',10080,3,0,NULL,1,'2026-08-05 19:42:39'),(36,10,0,0,'RETRY','LEAD',10080,3,0,NULL,1,'2026-08-05 19:42:39'),(37,11,27,0,'RETRY','LEAD',60,4,0,'NO_ANSWER',1,'2026-08-05 19:42:39'),(38,11,28,0,'RETRY','LEAD',120,4,0,'NO_ANSWER',1,'2026-08-05 19:42:40'),(39,11,29,0,'RETRY','LEAD',240,4,0,'NO_ANSWER',1,'2026-08-05 19:42:40'),(40,11,30,0,'RETRY','LEAD',30,4,0,'BUSY',1,'2026-08-05 19:42:40'),(41,11,31,0,'RETRY','LEAD',120,3,0,'NO_ANSWER',1,'2026-08-05 19:42:40'),(42,11,32,0,'RETRY','LEAD',60,3,0,'NO_ANSWER',1,'2026-08-05 19:42:40'),(43,11,0,0,'RETRY','LEAD',60,4,0,'NO_ANSWER',1,'2026-08-05 19:42:40'),(44,12,33,0,'NEXT_NUMBER','NUMBER',NULL,NULL,0,NULL,1,'2026-08-05 19:42:40'),(45,12,34,0,'RETRY','LEAD',4320,3,0,NULL,1,'2026-08-05 19:42:40'),(46,12,35,0,'CLOSE_LEAD','LOAN',NULL,NULL,0,'COMPLETED',1,'2026-08-05 19:42:40'),(47,12,0,0,'NEXT_NUMBER','NUMBER',NULL,NULL,0,NULL,1,'2026-08-05 19:42:40'),(48,13,36,0,'RETRY','LEAD',1440,3,0,NULL,1,'2026-08-05 19:42:40'),(49,13,0,0,'RETRY','LEAD',1440,3,0,NULL,1,'2026-08-05 19:42:40'),(50,14,37,0,'RETRY','LEAD',1440,2,0,NULL,1,'2026-08-05 19:42:40'),(51,14,0,0,'RETRY','LEAD',1440,2,0,NULL,1,'2026-08-05 19:42:40'),(52,15,38,0,'CLOSE_LEAD','LOAN',NULL,NULL,0,'COMPLETED',1,'2026-08-05 19:42:40'),(53,15,0,0,'CLOSE_LEAD','LOAN',NULL,NULL,0,'COMPLETED',1,'2026-08-05 19:42:40'),(54,16,39,0,'CLOSE_LEAD','LOAN',NULL,NULL,0,'COMPLETED',1,'2026-08-05 19:42:41'),(55,16,0,0,'CLOSE_LEAD','LOAN',NULL,NULL,0,'COMPLETED',1,'2026-08-05 19:42:41'),(56,17,40,0,'BLOCK_NUMBER','NUMBER',NULL,NULL,0,'WRONG_NUMBER',1,'2026-08-05 19:42:41'),(57,17,0,0,'BLOCK_NUMBER','NUMBER',NULL,NULL,0,'WRONG_NUMBER',1,'2026-08-05 19:42:41'),(58,18,41,0,'NO_RETRY','LEAD',NULL,NULL,0,NULL,1,'2026-08-05 19:42:41'),(59,18,0,0,'NO_RETRY','LEAD',NULL,NULL,0,NULL,1,'2026-08-05 19:42:41'),(60,19,42,0,'CLOSE_LEAD','LOAN',NULL,NULL,0,'COMPLETED',1,'2026-08-05 19:42:41'),(61,19,0,0,'CLOSE_LEAD','LOAN',NULL,NULL,0,'COMPLETED',1,'2026-08-05 19:42:41'),(62,20,43,0,'CLOSE_LEAD','LOAN',NULL,NULL,0,'COMPLETED',1,'2026-08-05 19:42:41'),(63,20,0,0,'CLOSE_LEAD','LOAN',NULL,NULL,0,'COMPLETED',1,'2026-08-05 19:42:41'),(64,21,44,0,'RETRY','LEAD',5,5,0,NULL,1,'2026-08-05 19:42:41'),(65,21,0,0,'RETRY','LEAD',5,5,0,NULL,1,'2026-08-05 19:42:41'),(66,22,45,0,'CLOSE_LEAD','LOAN',NULL,NULL,0,'COMPLETED',1,'2026-08-05 19:42:41'),(67,22,0,0,'CLOSE_LEAD','LOAN',NULL,NULL,0,'COMPLETED',1,'2026-08-05 19:42:41'),(68,23,46,0,'CLOSE_LEAD','LOAN',NULL,NULL,0,'COMPLETED',1,'2026-08-05 19:42:41'),(69,23,0,0,'CLOSE_LEAD','LOAN',NULL,NULL,0,'COMPLETED',1,'2026-08-05 19:42:41'),(70,24,47,0,'DNC','NUMBER',NULL,NULL,0,'DNC',1,'2026-08-05 19:42:41'),(71,24,48,0,'DNC','LOAN',NULL,NULL,0,'DNC',1,'2026-08-05 19:42:41'),(72,24,0,0,'DNC','NUMBER',NULL,NULL,0,'DNC',1,'2026-08-05 19:42:41'),(73,25,49,0,'RETRY','LEAD',NULL,NULL,0,'NO_ANSWER',1,'2026-08-05 19:42:41'),(74,25,50,0,'RETRY','LEAD',NULL,NULL,0,'BUSY',1,'2026-08-05 19:42:42'),(75,25,51,0,'RETRY','LEAD',NULL,NULL,0,'VOICEMAIL',1,'2026-08-05 19:42:42'),(76,25,52,0,'RETRY','LEAD',NULL,NULL,0,'FAILED',1,'2026-08-05 19:42:42'),(77,25,53,0,'RETRY','LEAD',15,NULL,0,'CANCELLED',1,'2026-08-05 19:42:42'),(78,25,54,0,'RETRY','LEAD',15,NULL,0,'CANCELLED',1,'2026-08-05 19:42:42'),(79,25,0,0,'RETRY','LEAD',NULL,NULL,0,'NO_ANSWER',1,'2026-08-05 19:42:42'),(80,26,55,0,'BLOCK_NUMBER','NUMBER',NULL,NULL,0,'WRONG_NUMBER',1,'2026-08-05 19:42:42'),(81,26,0,0,'BLOCK_NUMBER','NUMBER',NULL,NULL,0,'WRONG_NUMBER',1,'2026-08-05 19:42:42'),(82,27,56,0,'RETRY','LEAD',60,2,0,'CONNECTED',1,'2026-08-05 19:42:42'),(83,27,0,0,'RETRY','LEAD',60,2,0,'CONNECTED',1,'2026-08-05 19:42:42');
/*!40000 ALTER TABLE `disposition_rules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `dispositions`
--

DROP TABLE IF EXISTS `dispositions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dispositions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(32) NOT NULL,
  `label` varchar(120) NOT NULL,
  `kind` enum('agent','system') NOT NULL DEFAULT 'agent',
  `sort_order` int NOT NULL DEFAULT '0',
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_disposition_code` (`code`),
  KEY `idx_disposition_kind` (`kind`,`active`,`sort_order`)
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `dispositions`
--

LOCK TABLES `dispositions` WRITE;
/*!40000 ALTER TABLE `dispositions` DISABLE KEYS */;
INSERT INTO `dispositions` VALUES (1,'PAID','Paid','agent',10,1,'2026-08-05 19:42:37'),(2,'PC','Payment Confirmed','agent',20,1,'2026-08-05 19:42:37'),(3,'PTP','Promise To Pay','agent',30,1,'2026-08-05 19:42:37'),(4,'CBPTP','Callback Promise To Pay','agent',40,1,'2026-08-05 19:42:37'),(5,'SETT','Settlement','agent',50,1,'2026-08-05 19:42:38'),(6,'BPTP','Broken Promise To Pay','agent',60,1,'2026-08-05 19:42:38'),(7,'CB','Callback','agent',70,1,'2026-08-05 19:42:38'),(8,'FI','Financial Issue','agent',80,1,'2026-08-05 19:42:38'),(9,'NFI','Non-Financial Issue','agent',90,1,'2026-08-05 19:42:39'),(10,'SI','Service Issue','agent',100,1,'2026-08-05 19:42:39'),(11,'TNC','Tried Not Contacted','agent',110,1,'2026-08-05 19:42:39'),(12,'SKIP','Skip','agent',120,1,'2026-08-05 19:42:40'),(13,'LM','Left Message','agent',130,1,'2026-08-05 19:42:40'),(14,'LPR','Language Problem','agent',140,1,'2026-08-05 19:42:40'),(15,'LN','Legal Notice','agent',150,1,'2026-08-05 19:42:40'),(16,'PTV','Pick The Vehicle','agent',160,1,'2026-08-05 19:42:40'),(17,'WN','Wrong Number','agent',170,1,'2026-08-05 19:42:41'),(18,'ID','Intentional Defaulter','agent',180,1,'2026-08-05 19:42:41'),(19,'VPC','Vehicle Under Police Custody','agent',190,1,'2026-08-05 19:42:41'),(20,'VDLR','Vehicle With Dealer','agent',200,1,'2026-08-05 19:42:41'),(21,'CD','Call Drop','agent',210,1,'2026-08-05 19:42:41'),(22,'REPO','Vehicle Repo','agent',220,1,'2026-08-05 19:42:41'),(23,'ACCOUNT','Account Close','agent',230,1,'2026-08-05 19:42:41'),(24,'DNC','Do Not Call','agent',240,1,'2026-08-05 19:42:41'),(25,'SYS_NO_CONTACT','No Contact (system)','system',10,1,'2026-08-05 19:42:41'),(26,'SYS_INVALID','Invalid Number (system)','system',20,1,'2026-08-05 19:42:42'),(27,'SYS_NO_DISPOSITION','Not Dispositioned (system)','system',30,1,'2026-08-05 19:42:42');
/*!40000 ALTER TABLE `dispositions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employees`
--

DROP TABLE IF EXISTS `employees`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employees` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `sip_extension` varchar(32) NOT NULL,
  `sip_password` varchar(64) NOT NULL,
  `status` enum('offline','available','on_call','break') NOT NULL DEFAULT 'offline',
  `break_status` varchar(32) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  CONSTRAINT `fk_employees_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employees`
--

LOCK TABLES `employees` WRITE;
/*!40000 ALTER TABLE `employees` DISABLE KEYS */;
INSERT INTO `employees` VALUES (1,22,'6001','a16d73040d6705d0','offline',NULL,'2026-06-24 17:08:47','2026-06-24 17:08:47'),(2,23,'6002','0e53ef83a29529a6','offline',NULL,'2026-06-24 17:09:19','2026-06-24 17:09:19'),(3,24,'6003','2c63107d4f181670','offline',NULL,'2026-06-24 22:05:42','2026-06-24 22:05:42'),(4,25,'6004','f19c4c8596754b4a','offline',NULL,'2026-06-26 14:55:09','2026-06-26 14:55:09');
/*!40000 ALTER TABLE `employees` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `group_agents`
--

DROP TABLE IF EXISTS `group_agents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `group_agents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `group_id` int NOT NULL,
  `agent_id` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_group_agent` (`group_id`,`agent_id`),
  KEY `idx_ga_agent` (`agent_id`),
  CONSTRAINT `fk_ga_group` FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ga_user` FOREIGN KEY (`agent_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `group_agents`
--

LOCK TABLES `group_agents` WRITE;
/*!40000 ALTER TABLE `group_agents` DISABLE KEYS */;
INSERT INTO `group_agents` VALUES (3,1,22,'2026-06-24 22:06:18'),(4,1,24,'2026-06-24 22:06:18'),(5,2,23,'2026-06-26 14:55:25'),(6,2,25,'2026-06-26 14:55:25');
/*!40000 ALTER TABLE `group_agents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `group_tl`
--

DROP TABLE IF EXISTS `group_tl`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `group_tl` (
  `id` int NOT NULL AUTO_INCREMENT,
  `group_id` int NOT NULL,
  `tl_id` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_group_tl` (`group_id`,`tl_id`),
  KEY `idx_gtl_tl` (`tl_id`),
  CONSTRAINT `fk_gtl_group` FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_gtl_user` FOREIGN KEY (`tl_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `group_tl`
--

LOCK TABLES `group_tl` WRITE;
/*!40000 ALTER TABLE `group_tl` DISABLE KEYS */;
INSERT INTO `group_tl` VALUES (3,1,21,'2026-06-24 22:06:18'),(4,2,20,'2026-06-26 14:55:25');
/*!40000 ALTER TABLE `group_tl` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `groups`
--

DROP TABLE IF EXISTS `groups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `groups` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `description` varchar(500) DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  KEY `fk_groups_creator` (`created_by`),
  CONSTRAINT `fk_groups_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `groups`
--

LOCK TABLES `groups` WRITE;
/*!40000 ALTER TABLE `groups` DISABLE KEYS */;
INSERT INTO `groups` VALUES (1,'RahulGroup','This is RahulGroup',1,'2026-06-24 17:10:02','2026-06-24 17:10:02'),(2,'Deepak group','Deepak group',1,'2026-06-24 17:15:41','2026-06-24 17:15:41');
/*!40000 ALTER TABLE `groups` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `gsm_gateways`
--

DROP TABLE IF EXISTS `gsm_gateways`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `gsm_gateways` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `ip` varchar(64) NOT NULL,
  `port` smallint unsigned NOT NULL DEFAULT '5060',
  `channels` smallint unsigned NOT NULL DEFAULT '1' COMMENT 'Number of SIM/GSM channels',
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `asterisk_endpoint` varchar(100) DEFAULT NULL COMMENT 'PJSIP endpoint name in Asterisk, e.g. dinstar',
  `notes` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `priority` int NOT NULL DEFAULT '0' COMMENT 'Higher priority gateways are filled first; ties break on least-loaded',
  `reachable` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'Live health from Asterisk; the dialer skips 0',
  `last_ok_at` datetime DEFAULT NULL,
  `last_fail_at` datetime DEFAULT NULL,
  `fail_count` int NOT NULL DEFAULT '0' COMMENT 'Consecutive originate failures; reset on success',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `gsm_gateways`
--

LOCK TABLES `gsm_gateways` WRITE;
/*!40000 ALTER TABLE `gsm_gateways` DISABLE KEYS */;
INSERT INTO `gsm_gateways` VALUES (3,'dinstar','192.168.0.247',5060,1,'active','gw3','neww','2026-06-24 18:08:14','2026-08-14 17:56:36',0,1,'2026-08-05 20:08:06',NULL,0),(4,'fake to check','192.168.0.00',5060,1,'active','gw4',NULL,'2026-06-24 21:53:14','2026-08-01 02:29:07',0,0,NULL,NULL,0);
/*!40000 ALTER TABLE `gsm_gateways` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lead_rule_log`
--

DROP TABLE IF EXISTS `lead_rule_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lead_rule_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `csv_data_id` int DEFAULT NULL,
  `campaign_id` int DEFAULT NULL,
  `call_id` int DEFAULT NULL,
  `agent_id` int DEFAULT NULL,
  `loan_account` varchar(64) DEFAULT NULL,
  `phone_number` varchar(32) DEFAULT NULL,
  `disposition_id` int DEFAULT NULL,
  `reason_id` int DEFAULT NULL,
  `disposition` varchar(32) DEFAULT NULL COMMENT 'Code, denormalised so the log survives a vocabulary edit',
  `reason` varchar(64) DEFAULT NULL,
  `action` varchar(20) NOT NULL,
  `scope` varchar(10) NOT NULL,
  `call_status` varchar(32) DEFAULT NULL COMMENT 'The TECHNICAL result, recorded alongside — never the decider',
  `retry_at` datetime DEFAULT NULL,
  `detail` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_rule_log_lead` (`csv_data_id`,`created_at`),
  KEY `idx_rule_log_campaign` (`campaign_id`,`created_at`),
  KEY `idx_rule_log_action` (`action`,`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lead_rule_log`
--

LOCK TABLES `lead_rule_log` WRITE;
/*!40000 ALTER TABLE `lead_rule_log` DISABLE KEYS */;
INSERT INTO `lead_rule_log` VALUES (1,115,4,123,23,NULL,'9818435920',1,2,'PAID','SETTLEMENT_PAID','CLOSE_LEAD','LOAN','COMPLETED',NULL,'{\"ruleId\": 2, \"source\": \"rule:2\", \"delayMin\": null, \"exhausted\": false, \"leadsInScope\": 1, \"numbersBlocked\": 0, \"callbackRequired\": false}','2026-08-05 19:49:13'),(2,115,4,124,NULL,NULL,'9818435920',25,50,'SYS_NO_CONTACT','BUSY','NO_RETRY','LEAD','BUSY',NULL,'{\"ruleId\": 74, \"source\": \"rule:74\", \"delayMin\": null, \"exhausted\": false, \"leadsInScope\": 1, \"numbersBlocked\": 0, \"callbackRequired\": false}','2026-08-05 19:51:16'),(3,116,26,125,23,NULL,'9818435920',8,17,'FI','PFI_PERMANENT','CLOSE_LEAD','LOAN','COMPLETED',NULL,'{\"ruleId\": 24, \"source\": \"rule:24\", \"delayMin\": null, \"exhausted\": false, \"leadsInScope\": 1, \"numbersBlocked\": 0, \"callbackRequired\": false}','2026-08-05 20:09:23'),(4,116,3,129,23,NULL,'9818435920',24,47,'DNC','DO_NOT_CALL','DNC','NUMBER','DNC',NULL,'{\"ruleId\": 70, \"source\": \"rule:70\", \"delayMin\": null, \"exhausted\": false, \"leadsInScope\": 1, \"numbersBlocked\": 1, \"callbackRequired\": false}','2026-08-05 20:42:19');
/*!40000 ALTER TABLE `lead_rule_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lists`
--

DROP TABLE IF EXISTS `lists`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lists` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(150) NOT NULL,
  `description` varchar(500) DEFAULT NULL,
  `campaign_id` int NOT NULL,
  `active` enum('Y','N') NOT NULL DEFAULT 'N',
  `template_id` int DEFAULT NULL COMMENT 'Data Template (data_tables.id) applied to CSV uploads into this list',
  `fields` json DEFAULT NULL COMMENT 'Ordered custom field names stored from CSV uploads; NULL/[] = store all columns',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_lists_campaign_name` (`campaign_id`,`name`),
  KEY `fk_lists_template` (`template_id`),
  KEY `idx_lists_campaign_active` (`campaign_id`,`active`),
  CONSTRAINT `fk_lists_campaign` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_lists_template` FOREIGN KEY (`template_id`) REFERENCES `data_tables` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=39 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lists`
--

LOCK TABLES `lists` WRITE;
/*!40000 ALTER TABLE `lists` DISABLE KEYS */;
INSERT INTO `lists` VALUES (10,'Newtestforlist','Newtestforlist',3,'Y',NULL,'[\"Customer Name\", \"Mobile No\", \"Ref - No\", \"Address\", \"City\", \"State\", \"POST CODE\", \"Product\", \"Product Dis\", \"REG NO\", \"DPD\", \"LMPD\", \"LPC\", \"CBC\", \"Tenure\", \"Dealer Name\", \"Process Name\", \"Ref - 1 Name\", \"Ref_2 Name\", \"Ref_2 No\", \"M_Data\", \"Other\", \"Toss\", \"Title (Priority Data)\", \"checkfield\"]','2026-07-31 22:49:55','2026-08-05 20:47:41'),(36,'testtt','testtt',2,'Y',NULL,'[\"Customer Name\", \"Mobile No\", \"Ref - No\", \"Address\", \"City\", \"State\", \"POST CODE\", \"Product\", \"Product Dis\", \"REG NO\", \"DPD\", \"LMPD\", \"LPC\", \"CBC\", \"Tenure\", \"Dealer Name\", \"Process Name\", \"Ref - 1 Name\", \"Ref_2 Name\", \"Ref_2 No\", \"M_Data\", \"Other\", \"Toss\", \"Title (Priority Data)\"]','2026-08-03 23:13:33','2026-08-05 12:27:21'),(38,'Default List',NULL,3,'Y',NULL,'[\"Customer Name\", \"Mobile No\", \"Ref - No\", \"Address\", \"City\", \"State\", \"POST CODE\", \"Product\", \"Product Dis\", \"REG NO\", \"DPD\", \"LMPD\", \"LPC\", \"CBC\", \"Tenure\", \"Dealer Name\", \"Process Name\", \"Ref - 1 Name\", \"Ref_2 Name\", \"Ref_2 No\", \"M_Data\", \"Other\", \"Toss\", \"Title (Priority Data)\"]','2026-08-05 19:59:55','2026-08-05 20:44:11');
/*!40000 ALTER TABLE `lists` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pending_recordings`
--

DROP TABLE IF EXISTS `pending_recordings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pending_recordings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `extension` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone_number` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `filename` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `consumed` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_match` (`extension`,`phone_number`,`consumed`)
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pending_recordings`
--

LOCK TABLES `pending_recordings` WRITE;
/*!40000 ALTER TABLE `pending_recordings` DISABLE KEYS */;
INSERT INTO `pending_recordings` VALUES (1,'6001','9818435920','rec-6001-9818435920-1785533600888.wav','2026-08-01 03:03:21',1),(2,'6001','9818435920','rec-6001-9818435920-1785534075121.wav','2026-08-01 03:11:15',1),(3,'6001','9818435920','rec-6001-9818435920-1785534161987.wav','2026-08-01 03:12:42',1),(4,'6001','9818435920','rec-6001-9818435920-1785654956272.wav','2026-08-02 12:45:56',1),(5,'6001','9818465920','rec-6001-9818465920-1785662176365.wav','2026-08-02 14:46:16',1),(6,'6001','9818465920','rec-6001-9818465920-1785662267152.wav','2026-08-02 14:47:47',1),(7,'6001','9818465920','rec-6001-9818465920-1785662351922.wav','2026-08-02 14:49:12',1),(8,'6002','9818435920','rec-6002-9818435920-1785745727247.wav','2026-08-03 13:58:48',1),(9,'6002','7011455603','rec-6002-7011455603-1785746164527.wav','2026-08-03 14:06:04',1),(10,'6002','7011455603','rec-6002-7011455603-1785746315300.wav','2026-08-03 14:08:35',1),(11,'6002','7011455603','rec-6002-7011455603-1785746543323.wav','2026-08-03 14:12:24',1),(12,'6002','9818435920','rec-6002-9818435920-1785831842485.wav','2026-08-04 13:54:03',1),(13,'6002','9818435920','rec-6002-9818435920-1785832571808.wav','2026-08-04 14:06:11',1),(14,'6002','9818435920','rec-6002-9818435920-1785832748082.wav','2026-08-04 14:09:08',1),(15,'6002','9818435920','rec-6002-9818435920-1785935461272.wav','2026-08-05 18:41:01',1),(16,'6002','9818435920','rec-6002-9818435920-1785935583993.wav','2026-08-05 18:43:04',1),(17,'6002','9818435920','rec-6002-9818435920-1785939352511.wav','2026-08-05 19:45:53',1),(18,'6002','9818435920','rec-6002-9818435920-1785940814728.wav','2026-08-05 20:10:15',1),(19,'6002','9818435920','rec-6002-9818435920-1785941780776.wav','2026-08-05 20:26:21',1);
/*!40000 ALTER TABLE `pending_recordings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `performance`
--

DROP TABLE IF EXISTS `performance`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `performance` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int NOT NULL,
  `date` date NOT NULL,
  `calls_made` int NOT NULL DEFAULT '0',
  `calls_connected` int NOT NULL DEFAULT '0',
  `success_rate` decimal(5,2) NOT NULL DEFAULT '0.00',
  `total_duration_seconds` int NOT NULL DEFAULT '0',
  `break_duration_seconds` int NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_perf_emp_date` (`employee_id`,`date`),
  CONSTRAINT `fk_perf_employee` FOREIGN KEY (`employee_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=62 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `performance`
--

LOCK TABLES `performance` WRITE;
/*!40000 ALTER TABLE `performance` DISABLE KEYS */;
INSERT INTO `performance` VALUES (1,22,'2026-06-24',14,9,64.29,143,0,'2026-06-24 17:29:23'),(9,23,'2026-06-24',1,0,0.00,0,0,'2026-06-24 21:25:15'),(16,23,'2026-06-26',5,5,100.00,147,0,'2026-06-26 15:16:36'),(17,25,'2026-06-26',3,3,100.00,97,0,'2026-06-26 15:16:37'),(24,23,'2026-06-27',4,2,50.00,62,0,'2026-06-27 19:58:16'),(28,23,'2026-06-28',1,1,100.00,25,0,'2026-06-28 00:18:29'),(29,23,'2026-07-04',3,2,66.67,63,0,'2026-07-04 15:52:02'),(32,23,'2026-07-07',2,2,100.00,57,0,'2026-07-07 13:02:44'),(34,23,'2026-07-25',1,1,100.00,4,0,'2026-07-25 16:13:01'),(35,22,'2026-08-01',3,3,100.00,30,0,'2026-08-01 03:03:55'),(38,22,'2026-08-02',5,5,100.00,61,0,'2026-08-02 12:47:08'),(43,23,'2026-08-03',5,4,80.00,64,0,'2026-08-03 14:00:25'),(48,23,'2026-08-04',3,3,100.00,23,0,'2026-08-04 13:54:21'),(51,23,'2026-08-05',11,5,45.45,130,0,'2026-08-05 12:11:42');
/*!40000 ALTER TABLE `performance` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ps_aors`
--

DROP TABLE IF EXISTS `ps_aors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ps_aors` (
  `id` varchar(40) NOT NULL,
  `contact` varchar(255) DEFAULT NULL,
  `default_expiration` int DEFAULT NULL,
  `mailboxes` varchar(80) DEFAULT NULL,
  `max_contacts` smallint DEFAULT NULL,
  `minimum_expiration` int DEFAULT NULL,
  `remove_existing` enum('yes','no') DEFAULT NULL,
  `qualify_frequency` int DEFAULT NULL,
  `authenticate_qualify` enum('yes','no') DEFAULT NULL,
  `maximum_expiration` int DEFAULT NULL,
  `outbound_proxy` varchar(40) DEFAULT NULL,
  `support_path` enum('yes','no') DEFAULT NULL,
  `qualify_timeout` float DEFAULT NULL,
  `voicemail_extension` varchar(40) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ps_aors`
--

LOCK TABLES `ps_aors` WRITE;
/*!40000 ALTER TABLE `ps_aors` DISABLE KEYS */;
INSERT INTO `ps_aors` VALUES ('6001',NULL,NULL,NULL,1,NULL,'yes',NULL,NULL,NULL,NULL,NULL,NULL,NULL),('6002',NULL,NULL,NULL,1,NULL,'yes',NULL,NULL,NULL,NULL,NULL,NULL,NULL),('6003',NULL,NULL,NULL,1,NULL,'yes',NULL,NULL,NULL,NULL,NULL,NULL,NULL),('6004',NULL,NULL,NULL,1,NULL,'yes',NULL,NULL,NULL,NULL,NULL,NULL,NULL),('gw3','sip:192.168.0.247:5060',NULL,NULL,NULL,NULL,NULL,30,NULL,NULL,NULL,NULL,NULL,NULL),('gw4','sip:192.168.0.00:5060',NULL,NULL,NULL,NULL,NULL,30,NULL,NULL,NULL,NULL,NULL,NULL);
/*!40000 ALTER TABLE `ps_aors` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ps_auths`
--

DROP TABLE IF EXISTS `ps_auths`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ps_auths` (
  `id` varchar(40) NOT NULL,
  `auth_type` varchar(40) DEFAULT NULL,
  `nonce_lifetime` smallint DEFAULT NULL,
  `md5_cred` varchar(40) DEFAULT NULL,
  `password` varchar(80) DEFAULT NULL,
  `realm` varchar(40) DEFAULT NULL,
  `username` varchar(40) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ps_auths`
--

LOCK TABLES `ps_auths` WRITE;
/*!40000 ALTER TABLE `ps_auths` DISABLE KEYS */;
INSERT INTO `ps_auths` VALUES ('6001-auth','userpass',NULL,NULL,'a16d73040d6705d0',NULL,'6001'),('6002-auth','userpass',NULL,NULL,'0e53ef83a29529a6',NULL,'6002'),('6003-auth','userpass',NULL,NULL,'2c63107d4f181670',NULL,'6003'),('6004-auth','userpass',NULL,NULL,'f19c4c8596754b4a',NULL,'6004');
/*!40000 ALTER TABLE `ps_auths` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ps_endpoint_id_ips`
--

DROP TABLE IF EXISTS `ps_endpoint_id_ips`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ps_endpoint_id_ips` (
  `id` varchar(40) NOT NULL,
  `endpoint` varchar(40) DEFAULT NULL,
  `match` varchar(80) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ps_endpoint_id_ips`
--

LOCK TABLES `ps_endpoint_id_ips` WRITE;
/*!40000 ALTER TABLE `ps_endpoint_id_ips` DISABLE KEYS */;
INSERT INTO `ps_endpoint_id_ips` VALUES ('gw3-identify','gw3','192.168.0.247'),('gw4-identify','gw4','192.168.0.00');
/*!40000 ALTER TABLE `ps_endpoint_id_ips` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ps_endpoints`
--

DROP TABLE IF EXISTS `ps_endpoints`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ps_endpoints` (
  `id` varchar(40) NOT NULL,
  `transport` varchar(40) DEFAULT NULL,
  `aors` varchar(200) DEFAULT NULL,
  `auth` varchar(40) DEFAULT NULL,
  `context` varchar(40) DEFAULT NULL,
  `disallow` varchar(200) DEFAULT 'all',
  `allow` varchar(200) DEFAULT NULL,
  `direct_media` enum('yes','no') DEFAULT NULL,
  `dtmf_mode` varchar(40) DEFAULT NULL,
  `force_rport` enum('yes','no') DEFAULT NULL,
  `ice_support` enum('yes','no') DEFAULT NULL,
  `identify_by` varchar(40) DEFAULT NULL,
  `mailboxes` varchar(40) DEFAULT NULL,
  `moh_suggest` varchar(40) DEFAULT NULL,
  `outbound_auth` varchar(40) DEFAULT NULL,
  `outbound_proxy` varchar(40) DEFAULT NULL,
  `rewrite_contact` enum('yes','no') DEFAULT NULL,
  `rtp_symmetric` enum('yes','no') DEFAULT NULL,
  `send_pai` enum('yes','no') DEFAULT NULL,
  `send_rpid` enum('yes','no') DEFAULT NULL,
  `timers_min_se` smallint DEFAULT NULL,
  `timers` enum('forced','no','required','yes') DEFAULT NULL,
  `timers_sess_expires` int DEFAULT NULL,
  `callerid` varchar(40) DEFAULT NULL,
  `trust_id_inbound` enum('yes','no') DEFAULT NULL,
  `trust_id_outbound` enum('yes','no') DEFAULT NULL,
  `use_avpf` enum('yes','no') DEFAULT NULL,
  `media_encryption` varchar(40) DEFAULT NULL,
  `inband_progress` enum('yes','no') DEFAULT NULL,
  `call_group` varchar(40) DEFAULT NULL,
  `pickup_group` varchar(40) DEFAULT NULL,
  `t38_udptl` enum('yes','no') DEFAULT NULL,
  `t38_udptl_ec` varchar(40) DEFAULT NULL,
  `t38_udptl_maxdatagram` smallint DEFAULT NULL,
  `fax_detect` enum('yes','no') DEFAULT NULL,
  `tone_zone` varchar(40) DEFAULT NULL,
  `language` varchar(40) DEFAULT NULL,
  `one_touch_recording` enum('yes','no') DEFAULT NULL,
  `rtp_engine` varchar(40) DEFAULT NULL,
  `allow_transfer` enum('yes','no') DEFAULT NULL,
  `allow_subscribe` enum('yes','no') DEFAULT NULL,
  `from_user` varchar(40) DEFAULT NULL,
  `from_domain` varchar(40) DEFAULT NULL,
  `dtls_verify` varchar(40) DEFAULT NULL,
  `dtls_cert_file` varchar(200) DEFAULT NULL,
  `dtls_private_key` varchar(200) DEFAULT NULL,
  `dtls_cipher` varchar(200) DEFAULT NULL,
  `dtls_ca_file` varchar(200) DEFAULT NULL,
  `dtls_ca_path` varchar(200) DEFAULT NULL,
  `dtls_setup` varchar(40) DEFAULT NULL,
  `srtp_tag_32` enum('yes','no') DEFAULT NULL,
  `media_address` varchar(40) DEFAULT NULL,
  `set_var` text,
  `message_context` varchar(40) DEFAULT NULL,
  `accountcode` varchar(80) DEFAULT NULL,
  `media_encryption_optimistic` enum('yes','no') DEFAULT NULL,
  `rtp_timeout` int DEFAULT NULL,
  `rtp_timeout_hold` int DEFAULT NULL,
  `voicemail_extension` varchar(40) DEFAULT NULL,
  `deny` varchar(95) DEFAULT NULL,
  `permit` varchar(95) DEFAULT NULL,
  `acl` varchar(40) DEFAULT NULL,
  `contact_deny` varchar(95) DEFAULT NULL,
  `contact_permit` varchar(95) DEFAULT NULL,
  `contact_acl` varchar(40) DEFAULT NULL,
  `subscribe_context` varchar(40) DEFAULT NULL,
  `fax_detect_timeout` int DEFAULT NULL,
  `contact_user` varchar(80) DEFAULT NULL,
  `webrtc` enum('yes','no') DEFAULT NULL,
  `incoming_mwi_mailbox` varchar(40) DEFAULT NULL,
  `bundle` enum('yes','no') DEFAULT NULL,
  `dtls_auto_generate_cert` enum('yes','no') DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ps_endpoints`
--

LOCK TABLES `ps_endpoints` WRITE;
/*!40000 ALTER TABLE `ps_endpoints` DISABLE KEYS */;
INSERT INTO `ps_endpoints` VALUES ('6001','transport-wss','6001','6001-auth','from-webrtc','all','ulaw,alaw','no',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'yes',NULL,NULL,'yes'),('6002','transport-wss','6002','6002-auth','from-webrtc','all','ulaw,alaw','no',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'yes',NULL,NULL,'yes'),('6003','transport-wss','6003','6003-auth','from-webrtc','all','ulaw,alaw','no',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'yes',NULL,NULL,'yes'),('6004','transport-wss','6004','6004-auth','from-webrtc','all','ulaw,alaw','no',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'yes',NULL,NULL,'yes'),('gw3','transport-udp','gw3',NULL,'from-dinstar','all','ulaw,alaw','no',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'yes','yes',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('gw4','transport-udp','gw4',NULL,'from-dinstar','all','ulaw,alaw','no',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'yes','yes',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
/*!40000 ALTER TABLE `ps_endpoints` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `scheduled_calls`
--

DROP TABLE IF EXISTS `scheduled_calls`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `scheduled_calls` (
  `id` int NOT NULL AUTO_INCREMENT,
  `call_note_id` int DEFAULT NULL,
  `csv_data_id` int DEFAULT NULL,
  `campaign_id` int DEFAULT NULL,
  `list_id` int DEFAULT NULL,
  `phone_number` varchar(32) NOT NULL,
  `contact_name` varchar(150) DEFAULT NULL,
  `scheduled_at` datetime NOT NULL,
  `assigned_to` int DEFAULT NULL COMMENT 'Booking agent; NULL = campaign-wide callback any agent may take',
  `callback_type` enum('agent','campaign') NOT NULL DEFAULT 'agent' COMMENT 'agent = only the booking agent may take it; campaign = any agent on the campaign',
  `status` enum('pending','done','missed','cancelled') NOT NULL DEFAULT 'pending',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_sched_note` (`call_note_id`),
  KEY `idx_sched_assigned_status` (`assigned_to`,`status`),
  KEY `idx_sched_due` (`status`,`scheduled_at`),
  KEY `idx_sched_campaign` (`campaign_id`,`status`),
  KEY `idx_sched_lead` (`csv_data_id`),
  CONSTRAINT `fk_sched_assigned` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sched_note` FOREIGN KEY (`call_note_id`) REFERENCES `call_notes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `scheduled_calls`
--

LOCK TABLES `scheduled_calls` WRITE;
/*!40000 ALTER TABLE `scheduled_calls` DISABLE KEYS */;
INSERT INTO `scheduled_calls` VALUES (1,25,NULL,NULL,NULL,'9818435920','MOHD SUHAIL','2026-06-18 10:00:00',23,'agent','done','2026-06-27 20:24:51'),(4,45,110,4,33,'7011455603','Shiva Kumar','2026-08-03 15:11:00',23,'agent','pending','2026-08-03 14:11:00');
/*!40000 ALTER TABLE `scheduled_calls` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `settings`
--

DROP TABLE IF EXISTS `settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(80) NOT NULL,
  `setting_value` varchar(255) NOT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`)
) ENGINE=InnoDB AUTO_INCREMENT=77 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `settings`
--

LOCK TABLES `settings` WRITE;
/*!40000 ALTER TABLE `settings` DISABLE KEYS */;
INSERT INTO `settings` VALUES (1,'predictive_ratio','1','2026-06-24 22:49:41'),(2,'phone_cooldown_seconds','60','2026-06-24 22:57:17'),(3,'dialer_claim_timeout_sec','120','2026-06-24 22:57:17'),(4,'dialer_oncall_timeout_sec','1800','2026-06-24 22:57:17'),(25,'dialer_tick_ms','1000','2026-08-01 01:59:17'),(26,'dialer_wrapup_timeout_sec','900','2026-08-01 01:59:17'),(27,'dialer_ringing_timeout_sec','90','2026-08-01 01:59:17'),(28,'dialer_gateway_health_sec','20','2026-08-01 01:59:17'),(29,'dialer_gateway_fail_threshold','3','2026-08-01 01:59:17'),(30,'dialer_gateway_cooldown_sec','60','2026-08-01 01:59:17'),(31,'dialer_max_abandon_pct','3','2026-08-01 01:59:17'),(32,'dialer_callback_lookahead_min','5','2026-08-01 01:59:17'),(33,'dialer_enabled','1','2026-08-01 01:59:17'),(60,'dialer_amd_enabled','0','2026-08-01 02:15:18'),(61,'dialer_amd_context','predictive-amd','2026-08-01 02:15:18');
/*!40000 ALTER TABLE `settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `shifts`
--

DROP TABLE IF EXISTS `shifts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `shifts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `grace_minutes` int NOT NULL DEFAULT '15',
  `working_hours` decimal(4,2) DEFAULT NULL COMMENT 'Expected working hours; informational',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_shifts_creator` (`created_by`),
  KEY `idx_shifts_active` (`is_active`),
  CONSTRAINT `fk_shifts_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shifts`
--

LOCK TABLES `shifts` WRITE;
/*!40000 ALTER TABLE `shifts` DISABLE KEYS */;
/*!40000 ALTER TABLE `shifts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `teams`
--

DROP TABLE IF EXISTS `teams`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `teams` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `manager_id` int DEFAULT NULL,
  `tl_id` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_teams_manager` (`manager_id`),
  KEY `fk_teams_tl` (`tl_id`),
  CONSTRAINT `fk_teams_manager` FOREIGN KEY (`manager_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_teams_tl` FOREIGN KEY (`tl_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `teams`
--

LOCK TABLES `teams` WRITE;
/*!40000 ALTER TABLE `teams` DISABLE KEYS */;
/*!40000 ALTER TABLE `teams` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `email` varchar(180) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('admin','manager','tl','employee') NOT NULL,
  `team_id` int DEFAULT NULL,
  `shift_id` int DEFAULT NULL,
  `reports_to` int DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `sip_extension` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_users_role` (`role`),
  KEY `idx_users_team` (`team_id`),
  KEY `idx_users_reports_to` (`reports_to`),
  KEY `idx_users_shift` (`shift_id`),
  CONSTRAINT `fk_users_reports_to` FOREIGN KEY (`reports_to`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_users_shift` FOREIGN KEY (`shift_id`) REFERENCES `shifts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_users_team` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'Aarav Admin','admin@cc.test','$2a$10$BZKC9qtN846zxNTH27Zfh.fDkAFNvODrlGdAS7Uj3h7bjzL4DMBVK','admin',NULL,NULL,NULL,1,'2026-05-31 13:25:46','2026-05-31 13:25:46',NULL),(20,'Deepak','Deepak@gmail.com','$2a$10$ozMrhOv6lw3rRB.Li8Jwgumuv7V61H2wndZAJBerdgEBOZeoTdgWK','tl',NULL,NULL,NULL,1,'2026-06-24 17:05:28','2026-06-24 17:05:28',NULL),(21,'Rahul','Rahul@gmail.com','$2a$10$MiNOO/nr7NcXnbbxB72hUe0H9A/vQjsnwDVYh7.hgD2Mm1hXU/rei','tl',NULL,NULL,NULL,1,'2026-06-24 17:07:24','2026-06-24 17:07:24',NULL),(22,'RahulAgent','RahulAgent@gmail.com','$2a$10$H.cLF0DUwouw/vRMPI0lXeTTvMkq1UORnfF.9PJraCgP0VOJejFyO','employee',NULL,NULL,NULL,1,'2026-06-24 17:08:47','2026-06-24 17:08:47',NULL),(23,'DeepakAgent','DeepakAgent@gmail.com','$2a$10$pzxgQGm0QP6oolPiMVrIC.0re5MpUgyQJICEgN8BBaH01C8vSBPLW','employee',NULL,NULL,NULL,1,'2026-06-24 17:09:19','2026-06-24 17:09:19',NULL),(24,'RahulAgent2','RahulAgent2@gmail.com','$2a$10$F2p.P1yW2Dw1wdd71W1cEu8oijGp0xx3j/5on.Izw1dWg1d2p7qy2','employee',NULL,NULL,NULL,1,'2026-06-24 22:05:42','2026-06-24 22:05:42',NULL),(25,'DeepakAgent2','DeepakAgent2@gmail.com','$2a$10$KmZpO70MOVheOkAfaO0AqOu6qVi8.a9QymVlL7zEg5Et6H/Cu8MJS','employee',NULL,NULL,NULL,1,'2026-06-26 14:55:09','2026-06-26 14:55:09',NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'dialer'
--

--
-- Dumping routines for database 'dialer'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-08-14 19:23:17
