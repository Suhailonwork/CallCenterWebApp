-- MySQL dump 10.13  Distrib 8.0.45, for Linux (x86_64)
--
-- Host: localhost    Database: dialer
-- ------------------------------------------------------
-- Server version	8.0.45-0ubuntu0.24.04.1

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
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `agent_sessions`
--

LOCK TABLES `agent_sessions` WRITE;
/*!40000 ALTER TABLE `agent_sessions` DISABLE KEYS */;
INSERT INTO `agent_sessions` VALUES (1,7,'2026-05-31 06:25:48','2026-05-31 09:25:48','2026-05-31 13:25:48'),(2,7,'2026-05-31 11:25:48','2026-06-01 18:41:11','2026-05-31 13:25:48'),(3,13,'2026-05-31 13:46:26',NULL,'2026-05-31 13:46:26'),(4,7,'2026-06-01 18:41:11','2026-06-02 05:10:50','2026-06-01 18:41:11'),(5,7,'2026-06-02 05:10:50',NULL,'2026-06-02 05:10:50');
/*!40000 ALTER TABLE `agent_sessions` ENABLE KEYS */;
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
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
INSERT INTO `audit_logs` VALUES (1,1,'create_user','users',13,NULL,NULL,'2026-05-31 13:27:28'),(2,1,'create_gateway','gsm_gateways',1,NULL,NULL,'2026-05-31 13:28:09'),(3,1,'create_campaign','campaigns',2,NULL,NULL,'2026-05-31 13:30:20'),(4,1,'create_campaign','campaigns',3,NULL,NULL,'2026-05-31 13:38:42'),(5,1,'update_campaign','campaigns',3,NULL,NULL,'2026-05-31 13:45:46'),(6,1,'assign_campaign','campaigns',3,NULL,NULL,'2026-05-31 13:46:45'),(7,1,'create_gateway','gsm_gateways',2,NULL,NULL,'2026-06-01 18:51:05'),(8,1,'assign_campaign','campaigns',3,NULL,NULL,'2026-06-01 19:17:19'),(9,1,'create_gateway','gsm_gateways',3,NULL,NULL,'2026-06-01 20:11:26'),(10,1,'create_gateway','gsm_gateways',4,NULL,NULL,'2026-06-01 20:17:15'),(11,1,'update_campaign','campaigns',3,NULL,NULL,'2026-06-01 20:50:02'),(12,1,'update_campaign','campaigns',3,NULL,NULL,'2026-06-01 20:50:30'),(13,1,'update_campaign','campaigns',3,NULL,NULL,'2026-06-01 20:50:53'),(14,1,'update_campaign','campaigns',3,NULL,NULL,'2026-06-01 20:51:06'),(15,1,'update_campaign','campaigns',3,NULL,NULL,'2026-06-02 05:10:01'),(16,1,'update_campaign','campaigns',3,NULL,NULL,'2026-06-02 05:10:01'),(17,1,'update_campaign','campaigns',3,NULL,NULL,'2026-06-02 07:40:11'),(18,1,'assign_campaign','campaigns',3,NULL,NULL,'2026-06-02 07:40:24'),(19,1,'create_gateway','gsm_gateways',7,NULL,NULL,'2026-06-02 07:45:30'),(20,1,'update_campaign','campaigns',3,NULL,NULL,'2026-06-02 07:45:41'),(21,1,'update_campaign','campaigns',3,NULL,NULL,'2026-06-02 07:46:05');
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
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
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `call_notes`
--

LOCK TABLES `call_notes` WRITE;
/*!40000 ALTER TABLE `call_notes` DISABLE KEYS */;
INSERT INTO `call_notes` VALUES (1,1,7,'Spoke with the contact, interested - follow up later.','interested',NULL,'2026-05-31 13:25:47'),(2,3,7,'Spoke with the contact, interested - follow up later.','interested',NULL,'2026-05-31 13:25:47'),(3,4,7,'Spoke with the contact, interested - follow up later.','interested',NULL,'2026-05-31 13:25:47'),(4,8,7,'Spoke with the contact, interested - follow up later.','interested',NULL,'2026-05-31 13:25:47'),(5,9,7,'Spoke with the contact, interested - follow up later.','interested',NULL,'2026-05-31 13:25:47'),(6,10,7,'Spoke with the contact, interested - follow up later.','interested',NULL,'2026-05-31 13:25:47'),(7,13,7,'Spoke with the contact, interested - follow up later.','interested',NULL,'2026-05-31 13:25:47'),(8,15,7,'Spoke with the contact, interested - follow up later.','interested',NULL,'2026-05-31 13:25:48'),(9,18,7,'Spoke with the contact, interested - follow up later.','interested',NULL,'2026-05-31 13:25:48'),(10,19,7,'Spoke with the contact, interested - follow up later.','interested',NULL,'2026-05-31 13:25:48'),(11,21,7,NULL,NULL,NULL,'2026-06-01 19:17:51'),(12,22,7,NULL,NULL,NULL,'2026-06-01 19:53:34'),(13,23,7,NULL,NULL,NULL,'2026-06-01 19:57:48'),(14,24,7,NULL,NULL,NULL,'2026-06-01 19:58:23'),(15,25,7,NULL,NULL,NULL,'2026-06-01 20:15:47'),(16,26,7,NULL,NULL,NULL,'2026-06-01 20:16:08'),(17,27,7,NULL,NULL,NULL,'2026-06-01 20:36:24'),(18,28,7,NULL,NULL,NULL,'2026-06-02 06:25:42'),(19,29,7,NULL,NULL,NULL,'2026-06-02 06:26:15'),(20,30,7,NULL,NULL,NULL,'2026-06-02 07:40:59');
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
  `employee_id` int NOT NULL,
  `campaign_id` int DEFAULT NULL,
  `csv_data_id` int DEFAULT NULL,
  `phone_number` varchar(32) NOT NULL,
  `contact_name` varchar(150) DEFAULT NULL,
  `direction` enum('inbound','outbound') NOT NULL DEFAULT 'outbound',
  `status` enum('connected','no_answer','busy','failed','voicemail','wrong_number','completed') NOT NULL DEFAULT 'completed',
  `duration_seconds` int NOT NULL DEFAULT '0',
  `started_at` datetime DEFAULT NULL,
  `ended_at` datetime DEFAULT NULL,
  `recording_url` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_calls_campaign` (`campaign_id`),
  KEY `fk_calls_csv` (`csv_data_id`),
  KEY `idx_calls_employee_created` (`employee_id`,`created_at`),
  KEY `idx_calls_status` (`status`),
  CONSTRAINT `fk_calls_campaign` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_calls_csv` FOREIGN KEY (`csv_data_id`) REFERENCES `csv_data` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_calls_employee` FOREIGN KEY (`employee_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `calls`
--

LOCK TABLES `calls` WRITE;
/*!40000 ALTER TABLE `calls` DISABLE KEYS */;
INSERT INTO `calls` VALUES (1,7,1,NULL,'9860022334','Arjun Mehta','outbound','connected',312,'2026-05-25 13:25:47','2026-05-25 13:25:47',NULL,'2026-05-25 13:25:47'),(2,7,1,NULL,'9870055667','Divya Nair','outbound','no_answer',0,'2026-05-25 13:25:47','2026-05-25 13:25:47',NULL,'2026-05-25 13:25:47'),(3,7,1,NULL,'9850099001','Neha Kapoor','outbound','connected',275,'2026-05-26 13:25:47','2026-05-26 13:25:47',NULL,'2026-05-26 13:25:47'),(4,7,1,NULL,'9860022334','Arjun Mehta','outbound','connected',312,'2026-05-26 13:25:47','2026-05-26 13:25:47',NULL,'2026-05-26 13:25:47'),(5,7,1,NULL,'9870055667','Divya Nair','outbound','no_answer',0,'2026-05-26 13:25:47','2026-05-26 13:25:47',NULL,'2026-05-26 13:25:47'),(6,7,1,NULL,'9880088990','Karan Joshi','outbound','busy',0,'2026-05-26 13:25:47','2026-05-26 13:25:47',NULL,'2026-05-26 13:25:47'),(7,7,1,NULL,'9840077889','Vikram Singh','outbound','voicemail',0,'2026-05-27 13:25:47','2026-05-27 13:25:47',NULL,'2026-05-27 13:25:47'),(8,7,1,NULL,'9850099001','Neha Kapoor','outbound','connected',275,'2026-05-27 13:25:47','2026-05-27 13:25:47',NULL,'2026-05-27 13:25:47'),(9,7,1,NULL,'9860022334','Arjun Mehta','outbound','connected',312,'2026-05-27 13:25:47','2026-05-27 13:25:47',NULL,'2026-05-27 13:25:47'),(10,7,1,NULL,'9830044556','Sneha Iyer','outbound','connected',201,'2026-05-28 13:25:47','2026-05-28 13:25:47',NULL,'2026-05-28 13:25:47'),(11,7,1,NULL,'9840077889','Vikram Singh','outbound','voicemail',0,'2026-05-28 13:25:47','2026-05-28 13:25:47',NULL,'2026-05-28 13:25:47'),(12,7,1,NULL,'9820011223','Ankit Gupta','outbound','busy',0,'2026-05-29 13:25:47','2026-05-29 13:25:47',NULL,'2026-05-29 13:25:47'),(13,7,1,NULL,'9830044556','Sneha Iyer','outbound','connected',201,'2026-05-29 13:25:47','2026-05-29 13:25:47',NULL,'2026-05-29 13:25:47'),(14,7,1,NULL,'9840077889','Vikram Singh','outbound','voicemail',0,'2026-05-29 13:25:47','2026-05-29 13:25:47',NULL,'2026-05-29 13:25:47'),(15,7,1,NULL,'9850099001','Neha Kapoor','outbound','connected',275,'2026-05-29 13:25:48','2026-05-29 13:25:48',NULL,'2026-05-29 13:25:48'),(16,7,1,NULL,'9810012345','Priya Verma','outbound','no_answer',0,'2026-05-30 13:25:48','2026-05-30 13:25:48',NULL,'2026-05-30 13:25:48'),(17,7,1,NULL,'9820011223','Ankit Gupta','outbound','busy',0,'2026-05-30 13:25:48','2026-05-30 13:25:48',NULL,'2026-05-30 13:25:48'),(18,7,1,NULL,'9830044556','Sneha Iyer','outbound','connected',201,'2026-05-30 13:25:48','2026-05-30 13:25:48',NULL,'2026-05-30 13:25:48'),(19,7,1,NULL,'9818435920','Rohan Sharma','outbound','connected',90,'2026-05-31 13:25:48','2026-05-31 13:25:48',NULL,'2026-05-31 13:25:48'),(20,7,1,NULL,'9810012345','Priya Verma','outbound','no_answer',0,'2026-05-31 13:25:48','2026-05-31 13:25:48',NULL,'2026-05-31 13:25:48'),(21,7,NULL,NULL,'9818435920',NULL,'outbound','connected',0,'2026-06-01 19:17:50','2026-06-01 19:17:50',NULL,'2026-06-01 19:17:50'),(22,7,NULL,NULL,'9818435920',NULL,'outbound','connected',0,'2026-06-01 19:53:34','2026-06-01 19:53:34',NULL,'2026-06-01 19:53:34'),(23,7,NULL,NULL,'9818435920',NULL,'outbound','connected',0,'2026-06-01 19:57:48','2026-06-01 19:57:48',NULL,'2026-06-01 19:57:48'),(24,7,NULL,NULL,'9818435920',NULL,'outbound','connected',18,'2026-06-01 19:58:05','2026-06-01 19:58:23',NULL,'2026-06-01 19:58:23'),(25,7,NULL,NULL,'9818435920',NULL,'outbound','busy',0,'2026-06-01 20:15:47','2026-06-01 20:15:47',NULL,'2026-06-01 20:15:47'),(26,7,NULL,NULL,'9818435920',NULL,'outbound','no_answer',0,'2026-06-01 20:16:08','2026-06-01 20:16:08',NULL,'2026-06-01 20:16:08'),(27,7,NULL,NULL,'9818435920',NULL,'outbound','connected',0,'2026-06-01 20:36:24','2026-06-01 20:36:24',NULL,'2026-06-01 20:36:24'),(28,7,NULL,NULL,'9818435920',NULL,'outbound','connected',41,'2026-06-02 06:25:01','2026-06-02 06:25:42',NULL,'2026-06-02 06:25:42'),(29,7,NULL,NULL,'9818435920',NULL,'outbound','connected',18,'2026-06-02 06:25:57','2026-06-02 06:26:15',NULL,'2026-06-02 06:26:15'),(30,7,NULL,NULL,'9818435920',NULL,'outbound','no_answer',12,'2026-06-02 07:40:47','2026-06-02 07:40:59',NULL,'2026-06-02 07:40:59');
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
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `campaign_assignments`
--

LOCK TABLES `campaign_assignments` WRITE;
/*!40000 ALTER TABLE `campaign_assignments` DISABLE KEYS */;
INSERT INTO `campaign_assignments` VALUES (2,1,8,1,'2026-05-31 13:25:47'),(6,3,7,1,'2026-06-02 07:40:24');
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
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `campaign_gateways`
--

LOCK TABLES `campaign_gateways` WRITE;
/*!40000 ALTER TABLE `campaign_gateways` DISABLE KEYS */;
INSERT INTO `campaign_gateways` VALUES (9,1,6,'2026-06-02 05:53:28'),(12,3,6,'2026-06-02 07:46:05');
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
  `status` enum('active','paused','completed') NOT NULL DEFAULT 'active',
  `dialer_type` enum('predictive','manual','inbound','ratio') NOT NULL DEFAULT 'manual',
  `calling_start` time DEFAULT NULL,
  `calling_end` time DEFAULT NULL,
  `retry_count` int NOT NULL DEFAULT '0',
  `retry_delay_minutes` int NOT NULL DEFAULT '60',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_campaigns_creator` (`created_by`),
  CONSTRAINT `fk_campaigns_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `campaigns`
--

LOCK TABLES `campaigns` WRITE;
/*!40000 ALTER TABLE `campaigns` DISABLE KEYS */;
INSERT INTO `campaigns` VALUES (1,'Spring Outreach 2026','Outbound outreach to warm leads from the spring marketing list.','Hi {name}, this is {agent} calling from our team. Do you have a quick minute to talk about how we can help {company}?',1,'active','manual','09:00:00','18:00:00',0,60,'2026-05-31 13:25:47'),(2,'newcamp','newcamp','newcamp',1,'active','predictive',NULL,NULL,0,60,'2026-05-31 13:30:20'),(3,'new','new','new',1,'active','manual',NULL,NULL,0,60,'2026-05-31 13:38:42');
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
  `phone_number` varchar(32) NOT NULL,
  `name` varchar(150) DEFAULT NULL,
  `email` varchar(180) DEFAULT NULL,
  `company` varchar(150) DEFAULT NULL,
  `custom_fields` json DEFAULT NULL,
  `called` tinyint(1) NOT NULL DEFAULT '0',
  `call_status` varchar(32) DEFAULT NULL,
  `assigned_to` int DEFAULT NULL,
  `claimed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_csv_assigned` (`assigned_to`),
  KEY `idx_csv_campaign_called` (`campaign_id`,`called`),
  CONSTRAINT `fk_csv_assigned` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_csv_campaign` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `csv_data`
--

LOCK TABLES `csv_data` WRITE;
/*!40000 ALTER TABLE `csv_data` DISABLE KEYS */;
INSERT INTO `csv_data` VALUES (1,1,'9818435920','Rohan Sharma','rohan@acme.example','Acme Corp',NULL,0,NULL,NULL,NULL,'2026-05-31 13:25:47'),(2,1,'9810012345','Priya Verma','priya@globex.example','Globex',NULL,0,NULL,NULL,NULL,'2026-05-31 13:25:47'),(3,1,'9820011223','Ankit Gupta','ankit@initech.example','Initech',NULL,0,NULL,NULL,NULL,'2026-05-31 13:25:47'),(4,1,'9830044556','Sneha Iyer','sneha@umbrella.example','Umbrella Ltd',NULL,0,NULL,NULL,NULL,'2026-05-31 13:25:47'),(5,1,'9840077889','Vikram Singh','vikram@hooli.example','Hooli',NULL,0,NULL,NULL,NULL,'2026-05-31 13:25:47'),(6,1,'9850099001','Neha Kapoor','neha@stark.example','Stark Industries',NULL,0,NULL,NULL,NULL,'2026-05-31 13:25:47'),(7,1,'9860022334','Arjun Mehta','arjun@wayne.example','Wayne Enterprises',NULL,0,NULL,NULL,NULL,'2026-05-31 13:25:47'),(8,1,'9870055667','Divya Nair','divya@wonka.example','Wonka Inc',NULL,0,NULL,NULL,NULL,'2026-05-31 13:25:47'),(9,1,'9880088990','Karan Joshi','karan@soylent.example','Soylent Co',NULL,0,NULL,NULL,NULL,'2026-05-31 13:25:47'),(10,1,'9890011224','Pooja Reddy','pooja@cyberdyne.example','Cyberdyne',NULL,0,NULL,NULL,NULL,'2026-05-31 13:25:47');
/*!40000 ALTER TABLE `csv_data` ENABLE KEYS */;
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
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employees`
--

LOCK TABLES `employees` WRITE;
/*!40000 ALTER TABLE `employees` DISABLE KEYS */;
INSERT INTO `employees` VALUES (1,7,'6001','webrtcpass','offline',NULL,'2026-05-31 13:25:47','2026-05-31 13:25:47'),(2,8,'6002','webrtcpass','offline',NULL,'2026-05-31 13:25:47','2026-05-31 13:25:47'),(3,9,'6003','webrtcpass','offline',NULL,'2026-05-31 13:25:47','2026-05-31 13:25:47'),(4,10,'6004','webrtcpass','offline',NULL,'2026-05-31 13:25:47','2026-05-31 13:25:47'),(5,11,'6005','webrtcpass','offline',NULL,'2026-05-31 13:25:47','2026-05-31 13:25:47'),(6,12,'6006','webrtcpass','offline',NULL,'2026-05-31 13:25:47','2026-05-31 13:25:47'),(7,13,'6007','c9c7d02539fd1596','offline',NULL,'2026-05-31 13:27:28','2026-05-31 13:27:28');
/*!40000 ALTER TABLE `employees` ENABLE KEYS */;
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
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `gsm_gateways`
--

LOCK TABLES `gsm_gateways` WRITE;
/*!40000 ALTER TABLE `gsm_gateways` DISABLE KEYS */;
INSERT INTO `gsm_gateways` VALUES (6,'Dinstar','192.168.0.247',5060,1,'active','gw6',NULL,'2026-06-02 05:53:06','2026-06-02 06:21:05'),(7,'fake for test','192.168.0.234',5060,1,'active','gw7',NULL,'2026-06-02 07:45:30','2026-06-02 07:45:30');
/*!40000 ALTER TABLE `gsm_gateways` ENABLE KEYS */;
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
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `performance`
--

LOCK TABLES `performance` WRITE;
/*!40000 ALTER TABLE `performance` DISABLE KEYS */;
INSERT INTO `performance` VALUES (1,7,'2026-06-01',7,5,71.43,18,0,'2026-06-01 19:17:51'),(8,7,'2026-06-02',3,2,66.67,71,0,'2026-06-02 06:25:42');
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
INSERT INTO `ps_aors` VALUES ('101',NULL,NULL,NULL,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('6001',NULL,NULL,NULL,1,NULL,'yes',NULL,NULL,NULL,NULL,NULL,NULL,NULL),('6002',NULL,NULL,NULL,1,NULL,'yes',NULL,NULL,NULL,NULL,NULL,NULL,NULL),('6003',NULL,NULL,NULL,1,NULL,'yes',NULL,NULL,NULL,NULL,NULL,NULL,NULL),('6004',NULL,NULL,NULL,1,NULL,'yes',NULL,NULL,NULL,NULL,NULL,NULL,NULL),('6005',NULL,NULL,NULL,1,NULL,'yes',NULL,NULL,NULL,NULL,NULL,NULL,NULL),('6006',NULL,NULL,NULL,1,NULL,'yes',NULL,NULL,NULL,NULL,NULL,NULL,NULL),('6007',NULL,NULL,NULL,1,NULL,'yes',NULL,NULL,NULL,NULL,NULL,NULL,NULL),('gw6','sip:192.168.0.247:5060',NULL,NULL,1,NULL,NULL,30,NULL,NULL,NULL,NULL,NULL,NULL),('gw7','sip:192.168.0.234:5060',NULL,NULL,NULL,NULL,NULL,30,NULL,NULL,NULL,NULL,NULL,NULL);
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
INSERT INTO `ps_auths` VALUES ('101','userpass',NULL,NULL,'1234',NULL,'101'),('6001','userpass',NULL,NULL,'webrtcpass',NULL,'6001'),('6001-auth','userpass',NULL,NULL,'webrtcpass',NULL,'6001'),('6002','userpass',NULL,NULL,'webrtcpass',NULL,'6002'),('6003','userpass',NULL,NULL,'webrtcpass',NULL,'6003'),('6004','userpass',NULL,NULL,'webrtcpass',NULL,'6004'),('6005','userpass',NULL,NULL,'webrtcpass',NULL,'6005'),('6006','userpass',NULL,NULL,'webrtcpass',NULL,'6006'),('6007','userpass',NULL,NULL,'c9c7d02539fd1596',NULL,'6007'),('gw1','userpass',NULL,NULL,'dinstar123',NULL,'gw1');
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
INSERT INTO `ps_endpoint_id_ips` VALUES ('gw6-identify','gw6','192.168.0.247'),('gw7-identify','gw7','192.168.0.234');
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
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ps_endpoints`
--

LOCK TABLES `ps_endpoints` WRITE;
/*!40000 ALTER TABLE `ps_endpoints` DISABLE KEYS */;
INSERT INTO `ps_endpoints` VALUES ('101','transport-udp','101','101','default','all','ulaw',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('6001','transport-wss','6001','6001-auth','from-webrtc','all','ulaw,alaw',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'yes',NULL,NULL),('6002','transport-udp','6002','6002','default','all','ulaw,alaw',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'yes',NULL,NULL),('6003','transport-udp','6003','6003','default','all','ulaw,alaw',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'yes',NULL,NULL),('6004','transport-udp','6004','6004','default','all','ulaw,alaw',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'yes',NULL,NULL),('6005','transport-udp','6005','6005','default','all','ulaw,alaw',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'yes',NULL,NULL),('6006','transport-udp','6006','6006','default','all','ulaw,alaw',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'yes',NULL,NULL),('6007','transport-udp','6007','6007','default','all','ulaw,alaw',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'yes',NULL,NULL),('gw6','transport-udp','gw6',NULL,'from-trunk','all','ulaw,alaw',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),('gw7','transport-udp','gw7',NULL,'from-dinstar','all','ulaw,alaw','no',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'yes','yes',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
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
  `phone_number` varchar(32) NOT NULL,
  `contact_name` varchar(150) DEFAULT NULL,
  `scheduled_at` datetime NOT NULL,
  `assigned_to` int NOT NULL,
  `status` enum('pending','done','missed','cancelled') NOT NULL DEFAULT 'pending',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_sched_note` (`call_note_id`),
  KEY `idx_sched_assigned_status` (`assigned_to`,`status`),
  CONSTRAINT `fk_sched_assigned` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sched_note` FOREIGN KEY (`call_note_id`) REFERENCES `call_notes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `scheduled_calls`
--

LOCK TABLES `scheduled_calls` WRITE;
/*!40000 ALTER TABLE `scheduled_calls` DISABLE KEYS */;
INSERT INTO `scheduled_calls` VALUES (1,NULL,'9810012345','Priya Verma','2026-05-31 15:25:48',7,'pending','2026-05-31 13:25:48'),(2,NULL,'9820011223','Ankit Gupta','2026-06-01 13:25:48',7,'pending','2026-05-31 13:25:48');
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
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `settings`
--

LOCK TABLES `settings` WRITE;
/*!40000 ALTER TABLE `settings` DISABLE KEYS */;
INSERT INTO `settings` VALUES (1,'break_minutes_per_day','60','2026-05-31 13:25:48'),(2,'max_breaks_per_day','4','2026-05-31 13:25:48'),(3,'call_limit_per_day','120','2026-05-31 13:25:48'),(4,'work_start','09:00','2026-05-31 13:25:48'),(5,'work_end','18:00','2026-05-31 13:25:48'),(6,'min_password_length','8','2026-05-31 13:25:48'),(7,'recording_retention_days','90','2026-05-31 13:25:48');
/*!40000 ALTER TABLE `settings` ENABLE KEYS */;
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
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `teams`
--

LOCK TABLES `teams` WRITE;
/*!40000 ALTER TABLE `teams` DISABLE KEYS */;
INSERT INTO `teams` VALUES (1,'Team Alpha',2,4,'2026-05-31 13:25:46'),(2,'Team Beta',2,5,'2026-05-31 13:25:46'),(3,'Team Gamma',3,6,'2026-05-31 13:25:46');
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
  CONSTRAINT `fk_users_reports_to` FOREIGN KEY (`reports_to`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_users_team` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'Aarav Admin','admin@cc.test','$2a$10$BZKC9qtN846zxNTH27Zfh.fDkAFNvODrlGdAS7Uj3h7bjzL4DMBVK','admin',NULL,NULL,1,'2026-05-31 13:25:46','2026-05-31 13:25:46',NULL),(2,'Marcus Manager','manager1@cc.test','$2a$10$BZKC9qtN846zxNTH27Zfh.fDkAFNvODrlGdAS7Uj3h7bjzL4DMBVK','manager',NULL,1,1,'2026-05-31 13:25:46','2026-05-31 13:25:46',NULL),(3,'Maria Manager','manager2@cc.test','$2a$10$BZKC9qtN846zxNTH27Zfh.fDkAFNvODrlGdAS7Uj3h7bjzL4DMBVK','manager',NULL,1,1,'2026-05-31 13:25:46','2026-05-31 13:25:46',NULL),(4,'Tara Lead','tl1@cc.test','$2a$10$BZKC9qtN846zxNTH27Zfh.fDkAFNvODrlGdAS7Uj3h7bjzL4DMBVK','tl',1,2,1,'2026-05-31 13:25:46','2026-05-31 13:25:46',NULL),(5,'Tom Lead','tl2@cc.test','$2a$10$BZKC9qtN846zxNTH27Zfh.fDkAFNvODrlGdAS7Uj3h7bjzL4DMBVK','tl',2,2,1,'2026-05-31 13:25:46','2026-05-31 13:25:46',NULL),(6,'Tina Lead','tl3@cc.test','$2a$10$BZKC9qtN846zxNTH27Zfh.fDkAFNvODrlGdAS7Uj3h7bjzL4DMBVK','tl',3,3,1,'2026-05-31 13:25:46','2026-05-31 13:25:46',NULL),(7,'Eva Employee','emp1@cc.test','$2a$10$BZKC9qtN846zxNTH27Zfh.fDkAFNvODrlGdAS7Uj3h7bjzL4DMBVK','employee',1,4,1,'2026-05-31 13:25:46','2026-06-01 18:48:07','6001'),(8,'Ethan Employee','emp2@cc.test','$2a$10$BZKC9qtN846zxNTH27Zfh.fDkAFNvODrlGdAS7Uj3h7bjzL4DMBVK','employee',1,4,1,'2026-05-31 13:25:46','2026-05-31 13:25:47',NULL),(9,'Olivia Employee','emp3@cc.test','$2a$10$BZKC9qtN846zxNTH27Zfh.fDkAFNvODrlGdAS7Uj3h7bjzL4DMBVK','employee',2,5,1,'2026-05-31 13:25:46','2026-05-31 13:25:47',NULL),(10,'Liam Employee','emp4@cc.test','$2a$10$BZKC9qtN846zxNTH27Zfh.fDkAFNvODrlGdAS7Uj3h7bjzL4DMBVK','employee',2,5,1,'2026-05-31 13:25:46','2026-05-31 13:25:47',NULL),(11,'Sophia Employee','emp5@cc.test','$2a$10$BZKC9qtN846zxNTH27Zfh.fDkAFNvODrlGdAS7Uj3h7bjzL4DMBVK','employee',3,6,1,'2026-05-31 13:25:46','2026-05-31 13:25:47',NULL),(12,'Noah Employee','emp6@cc.test','$2a$10$BZKC9qtN846zxNTH27Zfh.fDkAFNvODrlGdAS7Uj3h7bjzL4DMBVK','employee',3,6,1,'2026-05-31 13:25:46','2026-05-31 13:25:47',NULL),(13,'adnan','adnan@gmail.com','$2a$10$hlbaZTAz.o49IyP3TahZV.tPHpoIH.vRW2UCqYLpK.0yGCyZNqxyu','employee',NULL,NULL,1,'2026-05-31 13:27:28','2026-05-31 13:27:28',NULL);
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

-- Dump completed on 2026-06-02  7:51:43
