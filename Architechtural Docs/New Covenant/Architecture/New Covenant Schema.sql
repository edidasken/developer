-- New Covenant Schema.sql
-- Authoritative schema source for Covenant + New_Covenant merged contract.
-- Machine JSON manifest is derived from this SQL by:
-- Running to Jesus/Bezalel/Scripts/generate_schema_manifest_from_sql.cjs
-- Generated at: 2026-04-28T20:51:17.840Z

BEGIN;

-- Optional namespace for New Covenant relational projection
CREATE SCHEMA IF NOT EXISTS new_covenant;
SET search_path TO new_covenant;

-- Manifest metadata for traceability
CREATE TABLE IF NOT EXISTS schema_manifest_meta (
  id TEXT PRIMARY KEY,
  generated_at TIMESTAMPTZ NOT NULL,
  source_sync_map TEXT,
  source_field_map TEXT,
  collections_in_sync_map NUMERIC,
  collections_with_field_map NUMERIC,
  collections_in_combined NUMERIC
);

INSERT INTO schema_manifest_meta (id, generated_at, source_sync_map, source_field_map, collections_in_sync_map, collections_with_field_map, collections_in_combined)
VALUES ('combined_schema_manifest_deployable', NOW(), 'Architechtural Docs/New Covenant/Architecture/B-Master Code.md', 'Architechtural Docs/New Covenant/Architecture/B-Master Code.md', 90, 69, 93)
ON CONFLICT (id) DO UPDATE SET
  generated_at = EXCLUDED.generated_at,
  source_sync_map = EXCLUDED.source_sync_map,
  source_field_map = EXCLUDED.source_field_map,
  collections_in_sync_map = EXCLUDED.collections_in_sync_map,
  collections_with_field_map = EXCLUDED.collections_with_field_map,
  collections_in_combined = EXCLUDED.collections_in_combined;

-- Firestore collection: books
-- Sheet mirror: Books
CREATE TABLE IF NOT EXISTS "books" (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: genealogy
-- Sheet mirror: Genealogy
CREATE TABLE IF NOT EXISTS "genealogy" (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: counseling
-- Sheet mirror: Counseling
CREATE TABLE IF NOT EXISTS "counseling" (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: devotionals
-- Sheet mirror: Devotionals
CREATE TABLE IF NOT EXISTS "devotionals" (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: reading
-- Sheet mirror: Reading
CREATE TABLE IF NOT EXISTS "reading" (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: words
-- Sheet mirror: Words
CREATE TABLE IF NOT EXISTS "words" (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: heart
-- Sheet mirror: Heart
CREATE TABLE IF NOT EXISTS "heart" (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: mirror
-- Sheet mirror: Mirror
CREATE TABLE IF NOT EXISTS "mirror" (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: theology
-- Sheet mirror: Theology
CREATE TABLE IF NOT EXISTS "theology" (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: quiz
-- Sheet mirror: Quiz
CREATE TABLE IF NOT EXISTS "quiz" (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: apologetics
-- Sheet mirror: Apologetics
CREATE TABLE IF NOT EXISTS "apologetics" (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: config
-- Sheet mirror: Config
CREATE TABLE IF NOT EXISTS "config" (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: missionsRegistry
-- Sheet mirror: MissionsRegistry
CREATE TABLE IF NOT EXISTS "missionsRegistry" (
  id TEXT PRIMARY KEY,
  "countryName" TEXT,
  "isoCode" BOOLEAN,
  "icon" TEXT,
  "tabName" TEXT,
  "region1040" TEXT,
  "continent" TEXT,
  "population" NUMERIC,
  "capital" TEXT,
  "officialLanguage" NUMERIC,
  "dominantReligion" TEXT,
  "persecutionRank" NUMERIC,
  "persecutionScore" NUMERIC,
  "persecutionLevel" TEXT,
  "gospelAccess" TEXT,
  "unreachedPeopleGroups" TEXT,
  "totalPeopleGroups" TEXT,
  "pctEvangelical" TEXT,
  "pctChristian" TEXT,
  "freedomIndex" TEXT,
  "regionCount" NUMERIC,
  "cityCount" NUMERIC,
  "partnerCount" NUMERIC,
  "lastUpdateAt" TIMESTAMPTZ,
  "status" TEXT,
  "sortOrder" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: missionsRegions
-- Sheet mirror: MissionsRegions
CREATE TABLE IF NOT EXISTS "missionsRegions" (
  id TEXT PRIMARY KEY,
  "countryId" TEXT,
  "regionName" TEXT,
  "regionType" TEXT,
  "population" NUMERIC,
  "coordinates" TEXT,
  "colorHex" TEXT,
  "dominantReligion" TEXT,
  "pctChristian" TEXT,
  "literacyRate" TEXT,
  "persecutionLevel" TEXT,
  "gospelAccess" TEXT,
  "unreachedGroups" TEXT,
  "securityThreat" TIMESTAMPTZ,
  "humanitarianNeed" TEXT,
  "mediaRestriction" TEXT,
  "churchPresence" TEXT,
  "missionaryAccess" TEXT,
  "primaryHurdle" TEXT,
  "notes" TEXT,
  "status" TEXT,
  "sortOrder" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: missionsCities
-- Sheet mirror: MissionsCities
CREATE TABLE IF NOT EXISTS "missionsCities" (
  id TEXT PRIMARY KEY,
  "countryId" TEXT,
  "regionId" TEXT,
  "cityName" TEXT,
  "cityType" TEXT,
  "population" NUMERIC,
  "coordinates" TEXT,
  "colorHex" TEXT,
  "literacyRate" TEXT,
  "dominantReligion" TEXT,
  "pctChristian" TEXT,
  "persecutionLevel" TEXT,
  "violenceLevel" TEXT,
  "churchLife" TEXT,
  "nationalLife" TEXT,
  "socialLife" TEXT,
  "privateLife" TEXT,
  "familyLife" TEXT,
  "gospelAccess" TEXT,
  "mediaRestriction" TEXT,
  "securityThreat" TIMESTAMPTZ,
  "humanitarianNeed" TEXT,
  "missionaryAccess" TEXT,
  "churchPresence" TEXT,
  "primaryHurdle" TEXT,
  "prayerFocus" TEXT,
  "notes" TEXT,
  "status" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: missionsPartners
-- Sheet mirror: MissionsPartners
CREATE TABLE IF NOT EXISTS "missionsPartners" (
  id TEXT PRIMARY KEY,
  "organizationName" TEXT,
  "partnerType" TEXT,
  "countryIds" TEXT,
  "contactName" TEXT,
  "contactEmail" TEXT,
  "contactPhone" TEXT,
  "website" TEXT,
  "focusArea" TEXT,
  "description" TEXT,
  "workersCount" NUMERIC,
  "relationshipStatus" TEXT,
  "financialSupport" TEXT,
  "prayerSupport" TEXT,
  "lastContactAt" TIMESTAMPTZ,
  "securityLevel" TEXT,
  "notes" TEXT,
  "status" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: missionsPrayerFocus
-- Sheet mirror: MissionsPrayerFocus
CREATE TABLE IF NOT EXISTS "missionsPrayerFocus" (
  id TEXT PRIMARY KEY,
  "countryId" TEXT,
  "cityId" TEXT,
  "title" TEXT,
  "description" TEXT,
  "scripture" TEXT,
  "startDate" TIMESTAMPTZ,
  "endDate" TIMESTAMPTZ,
  "priority" TEXT,
  "peopleGroup" TEXT,
  "prayerPoints" TEXT,
  "responsesCount" NUMERIC,
  "createdBy" TEXT,
  "status" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: missionsUpdates
-- Sheet mirror: MissionsUpdates
CREATE TABLE IF NOT EXISTS "missionsUpdates" (
  id TEXT PRIMARY KEY,
  "countryId" TEXT,
  "cityId" TEXT,
  "title" TEXT,
  "body" TEXT,
  "updateType" TEXT,
  "severity" TEXT,
  "source" TEXT,
  "verified" TEXT,
  "securityLevel" TEXT,
  "published" TEXT,
  "publishedBy" TEXT,
  "attachmentUrl" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: missionsTeams
-- Sheet mirror: MissionsTeams
CREATE TABLE IF NOT EXISTS "missionsTeams" (
  id TEXT PRIMARY KEY,
  "teamName" TEXT,
  "countryId" TEXT,
  "teamLeadId" TEXT,
  "teamLeadName" TEXT,
  "memberIds" TEXT,
  "memberNames" TEXT,
  "memberCount" NUMERIC,
  "tripType" TEXT,
  "startDate" TIMESTAMPTZ,
  "endDate" TIMESTAMPTZ,
  "budget" TEXT,
  "raised" TEXT,
  "objectives" TEXT,
  "partnerId" TEXT,
  "tripStatus" TEXT,
  "debriefNotes" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: missionsMetrics
-- Sheet mirror: MissionsMetrics
CREATE TABLE IF NOT EXISTS "missionsMetrics" (
  id TEXT PRIMARY KEY,
  "countryId" TEXT,
  "year" TEXT,
  "persecutionRank" NUMERIC,
  "persecutionScore" NUMERIC,
  "violenceScore" NUMERIC,
  "pressureScore" NUMERIC,
  "churchLifeScore" NUMERIC,
  "nationalLifeScore" NUMERIC,
  "socialLifeScore" NUMERIC,
  "privateLifeScore" NUMERIC,
  "familyLifeScore" NUMERIC,
  "population" NUMERIC,
  "pctChristian" TEXT,
  "pctEvangelical" TEXT,
  "unreachedGroups" TEXT,
  "source" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: statisticsConfig
-- Sheet mirror: StatisticsConfig
CREATE TABLE IF NOT EXISTS "statisticsConfig" (
  id TEXT PRIMARY KEY,
  "slot" TEXT,
  "label" TEXT,
  "description" TEXT,
  "category" TEXT,
  "sourceTab" TEXT,
  "sourceColumn" TEXT,
  "calcType" TEXT,
  "filterField" TEXT,
  "filterValue" TEXT,
  "dateField" TEXT,
  "formatType" TEXT,
  "unitLabel" TEXT,
  "displayOrder" TEXT,
  "widgetType" TEXT,
  "active" BOOLEAN,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: statisticsSnapshots
-- Sheet mirror: StatisticsSnapshots
CREATE TABLE IF NOT EXISTS "statisticsSnapshots" (
  id TEXT PRIMARY KEY,
  "snapshotDate" TIMESTAMPTZ,
  "periodType" TEXT,
  "periodLabel" TEXT,
  "notes" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ,
  "status" TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: statisticsViews
-- Sheet mirror: StatisticsCustomViews
CREATE TABLE IF NOT EXISTS "statisticsViews" (
  id TEXT PRIMARY KEY,
  "viewName" TEXT,
  "description" TEXT,
  "layoutType" TEXT,
  "slotsIncluded" TEXT,
  "chartType" TEXT,
  "periodType" TEXT,
  "dateRange" TEXT,
  "roleRequired" TEXT,
  "isDefault" BOOLEAN,
  "sortBy" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: members
-- Sheet mirror: Members
CREATE TABLE IF NOT EXISTS "members" (
  id TEXT PRIMARY KEY,
  "memberPin" TEXT,
  "firstName" TEXT,
  "lastName" TEXT,
  "preferredName" TEXT,
  "suffix" TEXT,
  "dateOfBirth" TEXT,
  "gender" TEXT,
  "photoUrl" TEXT,
  "primaryEmail" TEXT,
  "secondaryEmail" TEXT,
  "cellPhone" TEXT,
  "homePhone" TEXT,
  "workPhone" TEXT,
  "preferredContact" TEXT,
  "address1" TEXT,
  "address2" TEXT,
  "city" TEXT,
  "state" TEXT,
  "zip" TEXT,
  "country" TEXT,
  "membershipStatus" TEXT,
  "memberSince" TEXT,
  "howTheyFoundUs" TEXT,
  "baptismDate" TIMESTAMPTZ,
  "salvationDate" TIMESTAMPTZ,
  "dateOfDeath" TEXT,
  "householdId" TEXT,
  "familyRole" TEXT,
  "maritalStatus" TEXT,
  "spouseName" TEXT,
  "emergencyContact" TEXT,
  "emergencyPhone" TEXT,
  "ministryTeams" TEXT,
  "volunteerRoles" TEXT,
  "spiritualGifts" TEXT,
  "smallGroup" TEXT,
  "pastoralNotes" TEXT,
  "lastContactDate" TIMESTAMPTZ,
  "nextFollowUp" TEXT,
  "followUpPriority" TEXT,
  "assignedTo" TEXT,
  "tags" TEXT,
  "archived" BOOLEAN,
  "archiveReason" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedBy" TEXT,
  "updatedAt" TIMESTAMPTZ,
  "website" TEXT,
  "colorScheme" TEXT,
  "bgScheme" TEXT,
  "memberNumber" NUMERIC,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: prayers
-- Sheet mirror: PrayerRequests
CREATE TABLE IF NOT EXISTS "prayers" (
  id TEXT PRIMARY KEY,
  "requestId" TEXT,
  "memberId" TEXT,
  "name" TEXT,
  "submitterEmail" TEXT,
  "submitterPhone" TEXT,
  "text" TEXT,
  "category" TEXT,
  "confidential" TEXT,
  "followUp" TEXT,
  "status" TEXT,
  "adminNotes" TEXT,
  "assigned" TEXT,
  "submittedAt" TIMESTAMPTZ,
  "lastUpdated" TEXT,
  "updatedBy" TEXT,
  "archived" BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: journal
-- Sheet mirror: JournalEntries
CREATE TABLE IF NOT EXISTS "journal" (
  id TEXT PRIMARY KEY,
  "userEmail" TEXT,
  "title" TEXT,
  "entry" TEXT,
  "category" TEXT,
  "scriptureRef" TEXT,
  "mood" TEXT,
  "isPrivate" BOOLEAN,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: contactLog
-- Sheet mirror: ContactLog
CREATE TABLE IF NOT EXISTS "contactLog" (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: pastoralNotes
-- Sheet mirror: PastoralNotes
CREATE TABLE IF NOT EXISTS "pastoralNotes" (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: milestones
-- Sheet mirror: Milestones
CREATE TABLE IF NOT EXISTS "milestones" (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: households
-- Sheet mirror: Households
CREATE TABLE IF NOT EXISTS "households" (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: todos
-- Sheet mirror: ToDo
CREATE TABLE IF NOT EXISTS "todos" (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: attendance
-- Sheet mirror: Attendance
CREATE TABLE IF NOT EXISTS "attendance" (
  id TEXT PRIMARY KEY,
  "date" TIMESTAMPTZ,
  "serviceType" TEXT,
  "notes" TEXT,
  "recordedBy" TEXT,
  "createdAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: events
-- Sheet mirror: Events
CREATE TABLE IF NOT EXISTS "events" (
  id TEXT PRIMARY KEY,
  "title" TEXT,
  "description" TEXT,
  "eventType" TEXT,
  "location" TEXT,
  "startDate" TIMESTAMPTZ,
  "endDate" TIMESTAMPTZ,
  "startTime" TEXT,
  "endTime" TEXT,
  "recurring" TEXT,
  "recurringUntil" TEXT,
  "capacity" NUMERIC,
  "rsvpRequired" TEXT,
  "ministryTeam" TEXT,
  "contactPerson" TEXT,
  "status" TEXT,
  "visibility" TEXT,
  "notes" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedBy" TEXT,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: rsvps
-- Sheet mirror: EventRSVPs
CREATE TABLE IF NOT EXISTS "rsvps" (
  id TEXT PRIMARY KEY,
  "eventId" TEXT,
  "memberId" TEXT,
  "response" TEXT,
  "guestCount" NUMERIC,
  "notes" TEXT,
  "respondedAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: calendarEvents
-- Sheet mirror: CalendarEvents
CREATE TABLE IF NOT EXISTS "calendarEvents" (
  id TEXT PRIMARY KEY,
  "EventID" TEXT,
  "StartDateTime" TEXT,
  "EndDateTime" TEXT,
  "IsAllDay" BOOLEAN,
  "RecurrenceRule" TEXT,
  "SharedWith" TEXT,
  "DelegatedTo" TEXT,
  "CreatedAt" TIMESTAMPTZ,
  "CreatedBy" TEXT,
  "UpdatedAt" TIMESTAMPTZ,
  "UpdatedBy" TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: checkinSessions
-- Sheet mirror: CheckInSessions
CREATE TABLE IF NOT EXISTS "checkinSessions" (
  id TEXT PRIMARY KEY,
  "eventId" TEXT,
  "sessionName" TEXT,
  "date" TIMESTAMPTZ,
  "openedAt" TIMESTAMPTZ,
  "closedAt" TIMESTAMPTZ,
  "totalCheckIns" TEXT,
  "openedBy" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: groups
-- Sheet mirror: SmallGroups
CREATE TABLE IF NOT EXISTS "groups" (
  id TEXT PRIMARY KEY,
  "groupName" TEXT,
  "description" TEXT,
  "groupType" TEXT,
  "leaderId" TEXT,
  "coLeaderId" TEXT,
  "meetingDay" TEXT,
  "meetingTime" TEXT,
  "location" TEXT,
  "capacity" NUMERIC,
  "status" TEXT,
  "semester" TEXT,
  "notes" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: groupMembers
-- Sheet mirror: SmallGroupMembers
CREATE TABLE IF NOT EXISTS "groupMembers" (
  id TEXT PRIMARY KEY,
  "groupId" TEXT,
  "memberId" TEXT,
  "role" TEXT,
  "joinedDate" TIMESTAMPTZ,
  "leftDate" TIMESTAMPTZ,
  "status" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: giving
-- Sheet mirror: Giving
CREATE TABLE IF NOT EXISTS "giving" (
  id TEXT PRIMARY KEY,
  "memberId" TEXT,
  "donorName" TEXT,
  "amount" NUMERIC,
  "currency" TEXT,
  "date" TIMESTAMPTZ,
  "fund" TEXT,
  "method" TEXT,
  "checkNumber" NUMERIC,
  "transactionRef" TEXT,
  "isTaxDeductible" BOOLEAN,
  "notes" TEXT,
  "recordedBy" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: pledges
-- Sheet mirror: GivingPledges
CREATE TABLE IF NOT EXISTS "pledges" (
  id TEXT PRIMARY KEY,
  "memberId" TEXT,
  "fund" TEXT,
  "pledgeAmount" NUMERIC,
  "frequency" TEXT,
  "startDate" TIMESTAMPTZ,
  "endDate" TIMESTAMPTZ,
  "totalPledged" TEXT,
  "totalGiven" TEXT,
  "status" TEXT,
  "notes" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: volunteers
-- Sheet mirror: VolunteerSchedule
CREATE TABLE IF NOT EXISTS "volunteers" (
  id TEXT PRIMARY KEY,
  "memberId" TEXT,
  "ministryTeam" TEXT,
  "role" TEXT,
  "scheduledDate" TIMESTAMPTZ,
  "serviceType" TEXT,
  "status" TEXT,
  "swapRequested" TEXT,
  "swapWith" TEXT,
  "notes" TEXT,
  "scheduledBy" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: conversations
-- Sheet mirror: CommsThreads
CREATE TABLE IF NOT EXISTS "conversations" (
  id TEXT PRIMARY KEY,
  "subject" TEXT,
  "threadType" TEXT,
  "creatorId" TEXT,
  "creatorName" TEXT,
  "participantIds" TEXT,
  "participantNames" TEXT,
  "participantCount" NUMERIC,
  "messageCount" NUMERIC,
  "lastMessageAt" TIMESTAMPTZ,
  "lastMessageBy" TEXT,
  "lastSnippet" TEXT,
  "status" TEXT,
  "pinned" TEXT,
  "mutedBy" TEXT,
  "channelId" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: messages
-- Sheet mirror: CommsMessages
CREATE TABLE IF NOT EXISTS "messages" (
  id TEXT PRIMARY KEY,
  "threadId" TEXT,
  "senderId" TEXT,
  "senderName" TEXT,
  "senderEmail" TEXT,
  "recipientType" TEXT,
  "recipientId" TEXT,
  "recipientName" TEXT,
  "messageType" TEXT,
  "subject" TEXT,
  "body" TEXT,
  "priority" TEXT,
  "attachmentUrl" TEXT,
  "attachmentName" TEXT,
  "replyToId" TEXT,
  "status" TEXT,
  "sentAt" TIMESTAMPTZ,
  "editedAt" TIMESTAMPTZ,
  "readCount" NUMERIC,
  "flagged" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: notifications
-- Sheet mirror: CommsNotifications
CREATE TABLE IF NOT EXISTS "notifications" (
  id TEXT PRIMARY KEY,
  "recipientId" TEXT,
  "recipientName" TEXT,
  "recipientEmail" TEXT,
  "title" TEXT,
  "body" TEXT,
  "notifType" TEXT,
  "priority" TEXT,
  "entityType" TEXT,
  "entityId" TEXT,
  "actionUrl" TEXT,
  "icon" TEXT,
  "status" TEXT,
  "readAt" TIMESTAMPTZ,
  "dismissedAt" TIMESTAMPTZ,
  "sentVia" TEXT,
  "senderEmail" TEXT,
  "expiresAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: templates
-- Sheet mirror: CommsTemplates
CREATE TABLE IF NOT EXISTS "templates" (
  id TEXT PRIMARY KEY,
  "templateName" TEXT,
  "templateType" TEXT,
  "subject" TEXT,
  "body" TEXT,
  "bodyHtml" TEXT,
  "category" TEXT,
  "variables" TEXT,
  "useCount" NUMERIC,
  "lastUsedAt" TIMESTAMPTZ,
  "visibility" TEXT,
  "status" TEXT,
  "createdBy" TEXT,
  "createdByName" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: broadcasts
-- Sheet mirror: CommsBroadcastLog
CREATE TABLE IF NOT EXISTS "broadcasts" (
  id TEXT PRIMARY KEY,
  "type" TEXT,
  "subject" TEXT,
  "body" TEXT,
  "bodyHtml" TEXT,
  "audience" TEXT,
  "audienceFilter" TEXT,
  "templateId" TEXT,
  "channelId" TEXT,
  "sentAt" TIMESTAMPTZ,
  "sentBy" TEXT,
  "sentByName" TEXT,
  "recipientCount" NUMERIC,
  "deliveredCount" NUMERIC,
  "failedCount" NUMERIC,
  "status" TEXT,
  "scheduledFor" TEXT,
  "createdAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: ministries
-- Sheet mirror: Ministries
CREATE TABLE IF NOT EXISTS "ministries" (
  id TEXT PRIMARY KEY,
  "ministryName" TEXT,
  "category" TEXT,
  "description" TEXT,
  "leadId" TEXT,
  "coLeadId" TEXT,
  "contactEmail" TEXT,
  "meetingDay" TEXT,
  "meetingTime" TEXT,
  "meetingLocation" TEXT,
  "budgetAllocated" TEXT,
  "status" TEXT,
  "reportingTo" TEXT,
  "notes" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: servicePlans
-- Sheet mirror: ServicePlans
CREATE TABLE IF NOT EXISTS "servicePlans" (
  id TEXT PRIMARY KEY,
  "serviceDate" TIMESTAMPTZ,
  "serviceType" TEXT,
  "theme" TEXT,
  "scriptureFocus" TEXT,
  "sermonTitle" TEXT,
  "preacherId" TEXT,
  "worshipLeaderId" TEXT,
  "status" TEXT,
  "notes" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedBy" TEXT,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: songs
-- Sheet mirror: Songs
CREATE TABLE IF NOT EXISTS "songs" (
  id TEXT PRIMARY KEY,
  "title" TEXT,
  "artist" TEXT,
  "ccliNumber" NUMERIC,
  "defaultKey" TEXT,
  "tempoBpm" TEXT,
  "timeSignature" TEXT,
  "durationMin" TEXT,
  "genre" TEXT,
  "tags" TEXT,
  "lyrics" TEXT,
  "notes" TEXT,
  "active" BOOLEAN,
  "driveFileId" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedBy" TEXT,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: albums
-- Sheet mirror: Albums
CREATE TABLE IF NOT EXISTS "albums" (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: sermons
-- Sheet mirror: Sermons
CREATE TABLE IF NOT EXISTS "sermons" (
  id TEXT PRIMARY KEY,
  "title" TEXT,
  "preacherId" TEXT,
  "preacherName" TEXT,
  "date" TIMESTAMPTZ,
  "serviceType" TEXT,
  "seriesId" TEXT,
  "seriesOrder" TEXT,
  "scriptureRefs" TEXT,
  "topicTags" TEXT,
  "summary" TEXT,
  "driveFileId" TEXT,
  "fileUrl" TEXT,
  "filename" TEXT,
  "fileType" TEXT,
  "audioDriveId" TEXT,
  "videoDriveId" TEXT,
  "status" TEXT,
  "visibility" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: sermonSeries
-- Sheet mirror: SermonSeries
CREATE TABLE IF NOT EXISTS "sermonSeries" (
  id TEXT PRIMARY KEY,
  "seriesName" TEXT,
  "description" TEXT,
  "themeScripture" TEXT,
  "startDate" TIMESTAMPTZ,
  "endDate" TIMESTAMPTZ,
  "preacherId" TEXT,
  "status" TEXT,
  "coverImageUrl" TEXT,
  "sermonCount" NUMERIC,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: sermonReviews
-- Sheet mirror: SermonReviews
CREATE TABLE IF NOT EXISTS "sermonReviews" (
  id TEXT PRIMARY KEY,
  "sermonId" TEXT,
  "reviewerId" TEXT,
  "reviewerName" TEXT,
  "decision" TEXT,
  "feedback" TEXT,
  "reviewedAt" TIMESTAMPTZ,
  "privateNotes" TEXT,
  "createdAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: careCases
-- Sheet mirror: SpiritualCareCases
CREATE TABLE IF NOT EXISTS "careCases" (
  id TEXT PRIMARY KEY,
  "memberId" TEXT,
  "careType" TEXT,
  "priority" TEXT,
  "status" TEXT,
  "summary" TEXT,
  "assignedTeamId" TEXT,
  "primaryCg" TEXT,
  "secondaryCaregiverId" TEXT,
  "openedDate" TIMESTAMPTZ,
  "targetResolveDate" TIMESTAMPTZ,
  "resolvedDate" TIMESTAMPTZ,
  "referralInfo" TEXT,
  "confidential" TEXT,
  "notes" TEXT,
  "riskLevel" TEXT,
  "supportPresence" TEXT,
  "spiritualState" TEXT,
  "trend" TEXT,
  "linkedCaseId" TEXT,
  "nextReview" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedBy" TEXT,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: careInteractions
-- Sheet mirror: SpiritualCareInteractions
CREATE TABLE IF NOT EXISTS "careInteractions" (
  id TEXT PRIMARY KEY,
  "caseId" TEXT,
  "interactionDate" TIMESTAMPTZ,
  "type" TEXT,
  "caregiverId" TEXT,
  "durationMinutes" TEXT,
  "summary" TEXT,
  "followUpNeeded" TEXT,
  "followUpDate" TIMESTAMPTZ,
  "followUpDone" TEXT,
  "confidential" TEXT,
  "createdAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: careAssignments
-- Sheet mirror: SpiritualCareAssignments
CREATE TABLE IF NOT EXISTS "careAssignments" (
  id TEXT PRIMARY KEY,
  "caregiverId" TEXT,
  "memberId" TEXT,
  "ministryId" TEXT,
  "role" TEXT,
  "startDate" TIMESTAMPTZ,
  "endDate" TIMESTAMPTZ,
  "status" TEXT,
  "notes" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: compassionRequests
-- Sheet mirror: CompassionRequests
CREATE TABLE IF NOT EXISTS "compassionRequests" (
  id TEXT PRIMARY KEY,
  "requesterName" TEXT,
  "requesterPhone" TEXT,
  "requesterEmail" TEXT,
  "isMember" BOOLEAN,
  "memberId" TEXT,
  "requestType" TEXT,
  "description" TEXT,
  "urgency" TEXT,
  "amountRequested" TEXT,
  "amountApproved" TEXT,
  "status" TEXT,
  "assignedTeam" TEXT,
  "assignedTo" TEXT,
  "followUpDate" TIMESTAMPTZ,
  "resolutionNotes" TEXT,
  "confidential" TEXT,
  "submittedBy" TEXT,
  "approvedBy" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: compassionLogs
-- Sheet mirror: CompassionTeamLog
CREATE TABLE IF NOT EXISTS "compassionLogs" (
  id TEXT PRIMARY KEY,
  "requestId" TEXT,
  "date" TIMESTAMPTZ,
  "activityType" TEXT,
  "teamMemberId" TEXT,
  "teamMemberName" TEXT,
  "description" TEXT,
  "resourcesUsed" TEXT,
  "amountDisbursed" TEXT,
  "followUpNeeded" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: compassionResources
-- Sheet mirror: CompassionResources
CREATE TABLE IF NOT EXISTS "compassionResources" (
  id TEXT PRIMARY KEY,
  "resourceName" TEXT,
  "category" TEXT,
  "description" TEXT,
  "quantityOnHand" TEXT,
  "unit" TEXT,
  "reorderLevel" TEXT,
  "location" TEXT,
  "donatedBy" TEXT,
  "status" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: outreachContacts
-- Sheet mirror: OutreachContacts
CREATE TABLE IF NOT EXISTS "outreachContacts" (
  id TEXT PRIMARY KEY,
  "firstName" TEXT,
  "lastName" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "address" TEXT,
  "city" TEXT,
  "state" TEXT,
  "zip" TEXT,
  "source" TEXT,
  "campaignId" TEXT,
  "status" TEXT,
  "interestLevel" TEXT,
  "notes" TEXT,
  "memberId" TEXT,
  "assignedTo" TEXT,
  "lastContact" TEXT,
  "nextFollowUp" TEXT,
  "tags" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: outreachCampaigns
-- Sheet mirror: OutreachCampaigns
CREATE TABLE IF NOT EXISTS "outreachCampaigns" (
  id TEXT PRIMARY KEY,
  "campaignName" TEXT,
  "campaignType" TEXT,
  "description" TEXT,
  "startDate" TIMESTAMPTZ,
  "endDate" TIMESTAMPTZ,
  "location" TEXT,
  "ministryId" TEXT,
  "leadId" TEXT,
  "budget" TEXT,
  "goalReached" TEXT,
  "actualReached" TEXT,
  "decisions" TEXT,
  "status" TEXT,
  "notes" TEXT,
  "tags" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: outreachFollowUps
-- Sheet mirror: OutreachFollowUps
CREATE TABLE IF NOT EXISTS "outreachFollowUps" (
  id TEXT PRIMARY KEY,
  "contactId" TEXT,
  "date" TIMESTAMPTZ,
  "type" TEXT,
  "byId" TEXT,
  "summary" TEXT,
  "response" TEXT,
  "followUpNeeded" TEXT,
  "nextDate" TIMESTAMPTZ,
  "followUpDone" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: discipleshipPaths
-- Sheet mirror: DiscipleshipPaths
CREATE TABLE IF NOT EXISTS "discipleshipPaths" (
  id TEXT PRIMARY KEY,
  "name" TEXT,
  "description" TEXT,
  "category" TEXT,
  "targetAudience" TEXT,
  "difficultyLevel" TEXT,
  "estimatedWeeks" TEXT,
  "totalSteps" TEXT,
  "prerequisitePathId" TEXT,
  "requiredForLeadership" TEXT,
  "facilitatorGuideUrl" TEXT,
  "studentGuideUrl" TEXT,
  "status" TEXT,
  "visibility" TEXT,
  "createdBy" TEXT,
  "approvedBy" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: discipleshipSteps
-- Sheet mirror: DiscipleshipSteps
CREATE TABLE IF NOT EXISTS "discipleshipSteps" (
  id TEXT PRIMARY KEY,
  "pathId" TEXT,
  "stepOrder" TEXT,
  "title" TEXT,
  "description" TEXT,
  "stepType" TEXT,
  "durationMinutes" TEXT,
  "scriptureRefs" TEXT,
  "learningObjectives" TEXT,
  "contentUrl" TEXT,
  "videoUrl" TEXT,
  "homeworkDesc" TEXT,
  "assessmentRequired" TEXT,
  "passingScore" NUMERIC,
  "facilitatorNotes" TEXT,
  "resourceIds" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: discipleshipEnrollments
-- Sheet mirror: DiscipleshipEnrollments
CREATE TABLE IF NOT EXISTS "discipleshipEnrollments" (
  id TEXT PRIMARY KEY,
  "memberId" TEXT,
  "memberName" TEXT,
  "pathId" TEXT,
  "pathName" TEXT,
  "enrolledDate" TIMESTAMPTZ,
  "targetCompletion" TEXT,
  "actualCompletion" TEXT,
  "currentStepId" TEXT,
  "stepsCompleted" TEXT,
  "totalSteps" TEXT,
  "percentComplete" TEXT,
  "status" TEXT,
  "facilitatorId" TEXT,
  "facilitatorName" TEXT,
  "groupCohort" TEXT,
  "meetingDay" TEXT,
  "meetingTime" TEXT,
  "notes" TEXT,
  "enrolledBy" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: discipleshipMentoring
-- Sheet mirror: DiscipleshipMentoring
CREATE TABLE IF NOT EXISTS "discipleshipMentoring" (
  id TEXT PRIMARY KEY,
  "mentorId" TEXT,
  "mentorName" TEXT,
  "menteeId" TEXT,
  "menteeName" TEXT,
  "relationshipType" TEXT,
  "focusArea" TEXT,
  "startDate" TIMESTAMPTZ,
  "endDate" TIMESTAMPTZ,
  "meetingFrequency" TEXT,
  "meetingDay" TEXT,
  "meetingLocation" TEXT,
  "status" TEXT,
  "goals" TEXT,
  "notes" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: discipleshipMeetings
-- Sheet mirror: DiscipleshipMeetings
CREATE TABLE IF NOT EXISTS "discipleshipMeetings" (
  id TEXT PRIMARY KEY,
  "mentoringId" TEXT,
  "meetingDate" TIMESTAMPTZ,
  "meetingTime" TEXT,
  "durationMinutes" TEXT,
  "location" TEXT,
  "meetingType" TEXT,
  "topicsCovered" TEXT,
  "scriptureDiscussed" TEXT,
  "homeworkAssigned" TEXT,
  "homeworkCompleted" TEXT,
  "prayerRequests" TEXT,
  "actionItems" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: discipleshipAssessments
-- Sheet mirror: DiscipleshipAssessments
CREATE TABLE IF NOT EXISTS "discipleshipAssessments" (
  id TEXT PRIMARY KEY,
  "memberId" TEXT,
  "memberName" TEXT,
  "assessmentType" TEXT,
  "assessmentName" TEXT,
  "description" TEXT,
  "dateTaken" TEXT,
  "assessedBy" TEXT,
  "scoreTotal" NUMERIC,
  "scoreMax" TEXT,
  "scorePercent" NUMERIC,
  "resultsJson" TEXT,
  "topGifts" TEXT,
  "topStrengths" TEXT,
  "growthAreas" TEXT,
  "recommendations" TEXT,
  "enrollmentId" TEXT,
  "pathId" TEXT,
  "status" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: discipleshipMilestones
-- Sheet mirror: DiscipleshipMilestones
CREATE TABLE IF NOT EXISTS "discipleshipMilestones" (
  id TEXT PRIMARY KEY,
  "memberId" TEXT,
  "memberName" TEXT,
  "milestoneType" TEXT,
  "milestoneName" TEXT,
  "description" TEXT,
  "dateAchieved" TEXT,
  "verifiedBy" TEXT,
  "enrollmentId" TEXT,
  "pathId" TEXT,
  "certificateId" TEXT,
  "ceremonyDate" TIMESTAMPTZ,
  "witness" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: discipleshipGoals
-- Sheet mirror: DiscipleshipGoals
CREATE TABLE IF NOT EXISTS "discipleshipGoals" (
  id TEXT PRIMARY KEY,
  "memberId" TEXT,
  "memberName" TEXT,
  "goalCategory" TEXT,
  "goalTitle" TEXT,
  "description" TEXT,
  "targetDate" TIMESTAMPTZ,
  "completionDate" TIMESTAMPTZ,
  "status" TEXT,
  "progressPercent" NUMERIC,
  "measurementType" TEXT,
  "targetValue" TEXT,
  "currentValue" TEXT,
  "accountabilityPartnerId" TEXT,
  "accountabilityPartnerName" TEXT,
  "reviewFrequency" TEXT,
  "lastReviewed" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: discipleshipCertificates
-- Sheet mirror: DiscipleshipCertificates
CREATE TABLE IF NOT EXISTS "discipleshipCertificates" (
  id TEXT PRIMARY KEY,
  "memberId" TEXT,
  "memberName" TEXT,
  "pathId" TEXT,
  "pathName" TEXT,
  "enrollmentId" TEXT,
  "certificateNumber" NUMERIC,
  "issueDate" BOOLEAN,
  "issuedBy" BOOLEAN,
  "expiryDate" TIMESTAMPTZ,
  "status" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: learningTopics
-- Sheet mirror: LearningTopics
CREATE TABLE IF NOT EXISTS "learningTopics" (
  id TEXT PRIMARY KEY,
  "topicName" TEXT,
  "slug" TEXT,
  "description" TEXT,
  "parentTopicId" TEXT,
  "level" TEXT,
  "sortOrder" TEXT,
  "iconUrl" TEXT,
  "colorHex" TEXT,
  "featured" TEXT,
  "sermonCount" NUMERIC,
  "subscriberCount" NUMERIC,
  "status" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: learningPlaylists
-- Sheet mirror: LearningPlaylists
CREATE TABLE IF NOT EXISTS "learningPlaylists" (
  id TEXT PRIMARY KEY,
  "title" TEXT,
  "description" TEXT,
  "coverImageUrl" TEXT,
  "curatorId" TEXT,
  "curatorName" TEXT,
  "topicIds" TEXT,
  "topicNames" TEXT,
  "preacherFilter" TEXT,
  "scriptureFilter" TEXT,
  "difficultyLevel" TEXT,
  "estimatedHours" TEXT,
  "itemCount" NUMERIC,
  "subscriberCount" NUMERIC,
  "visibility" TEXT,
  "featured" TEXT,
  "sortOrder" TEXT,
  "tags" TEXT,
  "status" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: learningPlaylistItems
-- Sheet mirror: LearningPlaylistItems
CREATE TABLE IF NOT EXISTS "learningPlaylistItems" (
  id TEXT PRIMARY KEY,
  "playlistId" TEXT,
  "sermonId" TEXT,
  "sermonTitle" TEXT,
  "preacherName" TEXT,
  "scriptureRefs" TEXT,
  "sortOrder" TEXT,
  "sectionLabel" TEXT,
  "notesForLearner" TEXT,
  "durationMins" TEXT,
  "required" TEXT,
  "bonus" TEXT,
  "discussionQuestions" TEXT,
  "addedBy" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: learningProgress
-- Sheet mirror: LearningProgress
CREATE TABLE IF NOT EXISTS "learningProgress" (
  id TEXT PRIMARY KEY,
  "memberId" TEXT,
  "memberName" TEXT,
  "sermonId" TEXT,
  "sermonTitle" TEXT,
  "playlistId" TEXT,
  "playlistTitle" TEXT,
  "status" TEXT,
  "progressPercent" NUMERIC,
  "lastPositionSecs" TEXT,
  "totalDurationSecs" TEXT,
  "startedAt" TIMESTAMPTZ,
  "completedAt" TIMESTAMPTZ,
  "listenCount" NUMERIC,
  "lastListenedAt" TIMESTAMPTZ,
  "rating" TEXT,
  "device" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: learningNotes
-- Sheet mirror: LearningNotes
CREATE TABLE IF NOT EXISTS "learningNotes" (
  id TEXT PRIMARY KEY,
  "memberId" TEXT,
  "memberName" TEXT,
  "sermonId" TEXT,
  "sermonTitle" TEXT,
  "playlistId" TEXT,
  "noteType" TEXT,
  "title" TEXT,
  "content" TEXT,
  "timestampSecs" TEXT,
  "scriptureRef" TEXT,
  "highlightText" TEXT,
  "shared" TEXT,
  "pinned" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: learningBookmarks
-- Sheet mirror: LearningBookmarks
CREATE TABLE IF NOT EXISTS "learningBookmarks" (
  id TEXT PRIMARY KEY,
  "memberId" TEXT,
  "memberName" TEXT,
  "sermonId" TEXT,
  "sermonTitle" TEXT,
  "preacherName" TEXT,
  "collection" TEXT,
  "tags" TEXT,
  "notes" TEXT,
  "positionSecs" TEXT,
  "priority" TEXT,
  "reminderDate" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: learningRecommendations
-- Sheet mirror: LearningRecommendations
CREATE TABLE IF NOT EXISTS "learningRecommendations" (
  id TEXT PRIMARY KEY,
  "memberId" TEXT,
  "memberName" TEXT,
  "sermonId" TEXT,
  "sermonTitle" TEXT,
  "preacherName" TEXT,
  "reasonType" TEXT,
  "reasonText" TEXT,
  "topicMatch" TEXT,
  "scriptureMatch" TEXT,
  "score" NUMERIC,
  "priority" TEXT,
  "status" TEXT,
  "dismissedAt" TIMESTAMPTZ,
  "recommendedBy" TEXT,
  "recommendedByName" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: learningQuizzes
-- Sheet mirror: LearningQuizzes
CREATE TABLE IF NOT EXISTS "learningQuizzes" (
  id TEXT PRIMARY KEY,
  "sermonId" TEXT,
  "sermonTitle" TEXT,
  "playlistId" TEXT,
  "title" TEXT,
  "description" TEXT,
  "difficulty" TEXT,
  "passPercent" NUMERIC,
  "questionsJson" TEXT,
  "questionCount" NUMERIC,
  "timeLimitMins" TEXT,
  "attemptsAllowed" TEXT,
  "topicTags" TEXT,
  "scriptureRefs" TEXT,
  "status" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: learningQuizResults
-- Sheet mirror: LearningQuizResults
CREATE TABLE IF NOT EXISTS "learningQuizResults" (
  id TEXT PRIMARY KEY,
  "quizId" TEXT,
  "quizTitle" TEXT,
  "memberId" TEXT,
  "memberName" TEXT,
  "sermonId" TEXT,
  "attemptNumber" NUMERIC,
  "startedAt" TIMESTAMPTZ,
  "completedAt" TIMESTAMPTZ,
  "timeTakenSecs" TEXT,
  "answersJson" TEXT,
  "correctCount" NUMERIC,
  "totalQuestions" TEXT,
  "scorePercent" NUMERIC,
  "passed" TEXT,
  "feedback" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: learningCertificates
-- Sheet mirror: LearningCertificates
CREATE TABLE IF NOT EXISTS "learningCertificates" (
  id TEXT PRIMARY KEY,
  "memberId" TEXT,
  "memberName" TEXT,
  "certificateType" TEXT,
  "playlistId" TEXT,
  "playlistTitle" TEXT,
  "quizId" TEXT,
  "quizTitle" TEXT,
  "certificateNumber" NUMERIC,
  "issueDate" BOOLEAN,
  "issuedBy" BOOLEAN,
  "expiryDate" TIMESTAMPTZ,
  "status" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: theologyCategories
-- Sheet mirror: TheologyCategories
CREATE TABLE IF NOT EXISTS "theologyCategories" (
  id TEXT PRIMARY KEY,
  "categoryId" TEXT,
  "title" TEXT,
  "subtitle" TEXT,
  "intro" TEXT,
  "icon" TEXT,
  "colorVar" TEXT,
  "sortOrder" TEXT,
  "visible" TEXT,
  "status" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: theologySections
-- Sheet mirror: TheologySections
CREATE TABLE IF NOT EXISTS "theologySections" (
  id TEXT PRIMARY KEY,
  "categoryRowId" TEXT,
  "sectionId" TEXT,
  "title" TEXT,
  "content" TEXT,
  "summary" TEXT,
  "scriptureRefs" TEXT,
  "keywords" TEXT,
  "sortOrder" TEXT,
  "visible" TEXT,
  "approvedBy" TEXT,
  "approvedAt" TIMESTAMPTZ,
  "version" TEXT,
  "status" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: memberCards
-- Sheet mirror: MemberCards
CREATE TABLE IF NOT EXISTS "memberCards" (
  id TEXT PRIMARY KEY,
  "memberNumber" NUMERIC,
  "email" TEXT,
  "firstName" TEXT,
  "lastName" TEXT,
  "preferredName" TEXT,
  "suffix" TEXT,
  "photoUrl" TEXT,
  "cardTitle" TEXT,
  "cardBio" TEXT,
  "ministry" TEXT,
  "smallGroup" TEXT,
  "phone" TEXT,
  "phoneVisible" TEXT,
  "emailVisible" TEXT,
  "websiteUrl" TEXT,
  "scheduleUrl" TEXT,
  "colorScheme" TEXT,
  "bgScheme" TEXT,
  "cardIcon" TEXT,
  "showDailyBread" TEXT,
  "showPrayerTicker" TEXT,
  "cardFooter" TEXT,
  "visibility" TEXT,
  "viewCount" NUMERIC,
  "active" BOOLEAN,
  "status" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: cardLinks
-- Sheet mirror: MemberCardLinks
CREATE TABLE IF NOT EXISTS "cardLinks" (
  id TEXT PRIMARY KEY,
  "cardRowId" TEXT,
  "linkType" TEXT,
  "label" TEXT,
  "icon" TEXT,
  "url" TEXT,
  "sortOrder" TEXT,
  "visible" TEXT,
  "platform" TEXT,
  "status" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: memberCardViews
-- Sheet mirror: MemberCardViews
CREATE TABLE IF NOT EXISTS "memberCardViews" (
  id TEXT PRIMARY KEY,
  "cardRowId" TEXT,
  "memberNumber" NUMERIC,
  "viewerEmail" TEXT,
  "viewSource" TEXT,
  "userAgent" TEXT,
  "ipHash" TEXT,
  "viewedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: users
-- Sheet mirror: AuthUsers
CREATE TABLE IF NOT EXISTS "users" (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: accessControl
-- Sheet mirror: AccessControl
CREATE TABLE IF NOT EXISTS "accessControl" (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: permissions
-- Sheet mirror: Permissions
CREATE TABLE IF NOT EXISTS "permissions" (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: settings
-- Sheet mirror: Settings
CREATE TABLE IF NOT EXISTS "settings" (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: strategicGoals
-- Sheet mirror: StrategicGoals
CREATE TABLE IF NOT EXISTS "strategicGoals" (
  id TEXT PRIMARY KEY,
  "area" TEXT,
  "goal" TEXT,
  "progress" NUMERIC,
  "status" TEXT,
  "owner" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ,
  "createdBy" TEXT,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: strategicInitiatives
-- Sheet mirror: StrategicInitiatives
CREATE TABLE IF NOT EXISTS "strategicInitiatives" (
  id TEXT PRIMARY KEY,
  "title" TEXT,
  "ministry" TEXT,
  "owner" TEXT,
  "due" TIMESTAMPTZ,
  "dueISO" TIMESTAMPTZ,
  "progress" NUMERIC,
  "status" TEXT,
  "description" TEXT,
  "createdAt" TIMESTAMPTZ,
  "createdBy" TEXT,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- Firestore collection: strategicKeyDates
-- Sheet mirror: StrategicKeyDates
CREATE TABLE IF NOT EXISTS "strategicKeyDates" (
  id TEXT PRIMARY KEY,
  "label" TEXT,
  "date" TIMESTAMPTZ,
  "done" BOOLEAN,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ,
  "createdBy" TEXT,
  "updatedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB
);

-- GAS-only tab: ServiceOrders
-- Sheet mirror: ServiceOrders
CREATE TABLE IF NOT EXISTS "serviceOrders" (
  id TEXT PRIMARY KEY,
  "itemsJson" TEXT,
  "updatedAt" TIMESTAMPTZ,
  "updatedBy" TEXT,
  payload JSONB
);

COMMIT;
