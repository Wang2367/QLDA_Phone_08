SET XACT_ABORT ON;
IF OBJECT_ID('dbo.schema_migrations') IS NULL
 CREATE TABLE dbo.schema_migrations(version int NOT NULL PRIMARY KEY, appliedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME());
GO
IF NOT EXISTS (SELECT 1 FROM dbo.schema_migrations WHERE version=1)
BEGIN
BEGIN TRANSACTION;
CREATE SEQUENCE dbo.document_sequence AS bigint START WITH 10001 INCREMENT BY 1;
CREATE TABLE dbo.branches(id nvarchar(64) NOT NULL PRIMARY KEY, name nvarchar(80) NOT NULL, address nvarchar(180) NOT NULL);
CREATE TABLE dbo.roles(id nvarchar(30) NOT NULL PRIMARY KEY, name nvarchar(80) NOT NULL);
CREATE TABLE dbo.users(
 id nvarchar(64) NOT NULL PRIMARY KEY, username nvarchar(50) NOT NULL UNIQUE,
 name nvarchar(80) NOT NULL, passwordHash nvarchar(300) NOT NULL, active bit NOT NULL DEFAULT 1);
CREATE TABLE dbo.user_branch_roles(
 userId nvarchar(64) NOT NULL REFERENCES dbo.users(id), branchId nvarchar(64) NOT NULL REFERENCES dbo.branches(id),
 roleId nvarchar(30) NOT NULL REFERENCES dbo.roles(id), PRIMARY KEY(userId,branchId,roleId));
CREATE TABLE dbo.sessions(
 tokenHash varchar(64) NOT NULL PRIMARY KEY, userId nvarchar(64) NOT NULL REFERENCES dbo.users(id), expiresAt datetime2 NOT NULL);
CREATE TABLE dbo.products(id nvarchar(64) NOT NULL PRIMARY KEY, name nvarchar(120) NOT NULL, brand nvarchar(60) NOT NULL, trackingType varchar(10) NOT NULL CHECK(trackingType IN ('device','quantity')));
CREATE TABLE dbo.skus(
 id nvarchar(64) NOT NULL PRIMARY KEY, parentId nvarchar(64) NOT NULL REFERENCES dbo.products(id),
 sku nvarchar(40) NOT NULL UNIQUE, name nvarchar(120) NOT NULL, brand nvarchar(60) NOT NULL,
 category nvarchar(30) NOT NULL CHECK(category IN (N'Điện thoại',N'Phụ kiện')),
 price decimal(18,0) NOT NULL CHECK(price>0), tone varchar(20) NOT NULL DEFAULT 'slate', active bit NOT NULL DEFAULT 1);
CREATE TABLE dbo.devices(
 id nvarchar(64) NOT NULL PRIMARY KEY, productId nvarchar(64) NOT NULL REFERENCES dbo.skus(id),
 branchId nvarchar(64) NULL REFERENCES dbo.branches(id), serial nvarchar(60) NULL,
 status varchar(20) NOT NULL CHECK(status IN ('available','sold','moving','quarantine','exported','warranty')),
 CHECK(status<>'available' OR branchId IS NOT NULL));
CREATE UNIQUE INDEX UX_devices_serial ON dbo.devices(serial) WHERE serial IS NOT NULL;
CREATE INDEX IX_devices_branch ON dbo.devices(branchId,productId,status);
CREATE TABLE dbo.device_imeis(
 imei varchar(15) NOT NULL PRIMARY KEY CHECK(LEN(imei)=15 AND imei NOT LIKE '%[^0-9]%'),
 deviceId nvarchar(64) NOT NULL REFERENCES dbo.devices(id));
CREATE INDEX IX_imeis_device ON dbo.device_imeis(deviceId);
CREATE TABLE dbo.stock_balances(
 branchId nvarchar(64) NOT NULL REFERENCES dbo.branches(id), productId nvarchar(64) NOT NULL REFERENCES dbo.skus(id),
 available int NOT NULL DEFAULT 0 CHECK(available>=0), quarantine int NOT NULL DEFAULT 0 CHECK(quarantine>=0),
 revision int NOT NULL DEFAULT 0, PRIMARY KEY(branchId,productId));
CREATE TABLE dbo.warranty_policies(
 id nvarchar(64) NOT NULL PRIMARY KEY, productId nvarchar(64) NOT NULL REFERENCES dbo.skus(id), months int NOT NULL CHECK(months BETWEEN 1 AND 120),
 coverage nvarchar(300) NOT NULL, exclusions nvarchar(300) NOT NULL, effectiveAt datetime2 NOT NULL);
CREATE INDEX IX_policy_effective ON dbo.warranty_policies(productId,effectiveAt);
CREATE TABLE dbo.sales_orders(
 id nvarchar(64) NOT NULL PRIMARY KEY, invoiceNo nvarchar(64) NULL, branchId nvarchar(64) NOT NULL REFERENCES dbo.branches(id),
 cashierId nvarchar(64) NOT NULL REFERENCES dbo.users(id), customer nvarchar(100) NOT NULL,
 status varchar(20) NOT NULL CHECK(status IN ('draft','paid')), method nvarchar(40) NULL,
 total decimal(18,0) NOT NULL CHECK(total>=0), date datetime2 NOT NULL, paidAt datetime2 NULL);
CREATE UNIQUE INDEX UX_sales_invoice ON dbo.sales_orders(invoiceNo) WHERE invoiceNo IS NOT NULL;
CREATE INDEX IX_sales_branch_date ON dbo.sales_orders(branchId,date);
CREATE TABLE dbo.sale_lines(
 id nvarchar(64) NOT NULL PRIMARY KEY, saleId nvarchar(64) NOT NULL REFERENCES dbo.sales_orders(id), lineIndex int NOT NULL,
 productId nvarchar(64) NOT NULL REFERENCES dbo.skus(id), deviceId nvarchar(64) NULL REFERENCES dbo.devices(id),
 qty int NOT NULL CHECK(qty>0), price decimal(18,0) NOT NULL CHECK(price>0), name nvarchar(120) NOT NULL, sku nvarchar(40) NOT NULL,
 policyId nvarchar(64) NULL REFERENCES dbo.warranty_policies(id), UNIQUE(saleId,lineIndex), CHECK(deviceId IS NULL OR qty=1));
CREATE INDEX IX_sale_device ON dbo.sale_lines(deviceId);
CREATE TABLE dbo.receipts(
 id nvarchar(64) NOT NULL PRIMARY KEY, branchId nvarchar(64) NOT NULL REFERENCES dbo.branches(id),
 actorId nvarchar(64) NOT NULL REFERENCES dbo.users(id), type nvarchar(30) NOT NULL,
 status varchar(20) NOT NULL CHECK(status IN ('draft','confirmed')), note nvarchar(300) NOT NULL, date datetime2 NOT NULL);
CREATE TABLE dbo.receipt_lines(
 id nvarchar(64) NOT NULL PRIMARY KEY, receiptId nvarchar(64) NOT NULL REFERENCES dbo.receipts(id),
 productId nvarchar(64) NOT NULL REFERENCES dbo.skus(id), deviceId nvarchar(64) NULL REFERENCES dbo.devices(id),
 qty int NOT NULL CHECK(qty>0), serial nvarchar(60) NULL, imeis nvarchar(1000) NULL);
CREATE TABLE dbo.stock_movements(
 id nvarchar(64) NOT NULL PRIMARY KEY, branchId nvarchar(64) NOT NULL REFERENCES dbo.branches(id),
 productId nvarchar(64) NOT NULL REFERENCES dbo.skus(id), deviceId nvarchar(64) NULL REFERENCES dbo.devices(id),
 actorId nvarchar(64) NOT NULL REFERENCES dbo.users(id), qty int NOT NULL CHECK(qty>0),
 deltaAvailable int NOT NULL, deltaQuarantine int NOT NULL, type nvarchar(40) NOT NULL,
 sourceType varchar(30) NOT NULL, sourceId nvarchar(64) NOT NULL, leg varchar(40) NOT NULL,
 note nvarchar(300) NOT NULL, date datetime2 NOT NULL, UNIQUE(sourceType,sourceId,leg));
CREATE INDEX IX_movements_branch_date ON dbo.stock_movements(branchId,date);
CREATE TABLE dbo.transfers(
 id nvarchar(64) NOT NULL PRIMARY KEY, fromBranch nvarchar(64) NOT NULL REFERENCES dbo.branches(id),
 toBranch nvarchar(64) NOT NULL REFERENCES dbo.branches(id), createdBy nvarchar(64) NOT NULL REFERENCES dbo.users(id),
 approvedBy nvarchar(64) NULL REFERENCES dbo.users(id), receivedBy nvarchar(64) NULL REFERENCES dbo.users(id),
 status varchar(20) NOT NULL CHECK(status IN ('pending','approved','moving','review','received')),
 note nvarchar(300) NOT NULL, discrepancy nvarchar(500) NULL, resolution nvarchar(500) NULL,
 date datetime2 NOT NULL, updatedAt datetime2 NULL, CHECK(fromBranch<>toBranch));
CREATE TABLE dbo.transfer_lines(
 id nvarchar(64) NOT NULL PRIMARY KEY, transferId nvarchar(64) NOT NULL REFERENCES dbo.transfers(id),
 productId nvarchar(64) NOT NULL REFERENCES dbo.skus(id), deviceId nvarchar(64) NULL REFERENCES dbo.devices(id),
 qty int NOT NULL CHECK(qty>0), receivedQty int NOT NULL DEFAULT 0 CHECK(receivedQty>=0),
 CHECK(deviceId IS NULL OR qty=1), CHECK(receivedQty<=qty));
CREATE TABLE dbo.transfer_discrepancies(
 id nvarchar(64) NOT NULL PRIMARY KEY, transferId nvarchar(64) NOT NULL REFERENCES dbo.transfers(id),
 actorId nvarchar(64) NOT NULL REFERENCES dbo.users(id), note nvarchar(500) NOT NULL,
 resolution nvarchar(500) NULL, date datetime2 NOT NULL, resolvedAt datetime2 NULL);
CREATE TABLE dbo.returns(
 id nvarchar(64) NOT NULL PRIMARY KEY, saleLineId nvarchar(64) NOT NULL REFERENCES dbo.sale_lines(id),
 branchId nvarchar(64) NOT NULL REFERENCES dbo.branches(id), qty int NOT NULL CHECK(qty>0),
 reason nvarchar(500) NOT NULL, status varchar(20) NOT NULL CHECK(status IN ('pending','approved','returned')),
 condition varchar(20) NULL CHECK(condition IN ('available','quarantine')), createdBy nvarchar(64) NOT NULL REFERENCES dbo.users(id),
 approvedBy nvarchar(64) NULL REFERENCES dbo.users(id), date datetime2 NOT NULL);
CREATE TABLE dbo.return_events(
 id nvarchar(64) NOT NULL PRIMARY KEY, returnId nvarchar(64) NOT NULL REFERENCES dbo.returns(id), actorId nvarchar(64) NOT NULL REFERENCES dbo.users(id),
 status varchar(20) NOT NULL, note nvarchar(500) NOT NULL, date datetime2 NOT NULL);
CREATE TABLE dbo.warranty_tickets(
 id nvarchar(64) NOT NULL PRIMARY KEY, saleLineId nvarchar(64) NOT NULL REFERENCES dbo.sale_lines(id),
 branchId nvarchar(64) NOT NULL REFERENCES dbo.branches(id), policyId nvarchar(64) NOT NULL REFERENCES dbo.warranty_policies(id),
 reason nvarchar(500) NOT NULL, status varchar(20) NOT NULL CHECK(status IN ('received','processing','done')),
 createdBy nvarchar(64) NOT NULL REFERENCES dbo.users(id), date datetime2 NOT NULL);
CREATE TABLE dbo.warranty_events(
 id nvarchar(64) NOT NULL PRIMARY KEY, ticketId nvarchar(64) NOT NULL REFERENCES dbo.warranty_tickets(id), actorId nvarchar(64) NOT NULL REFERENCES dbo.users(id),
 status varchar(20) NOT NULL, note nvarchar(500) NOT NULL, date datetime2 NOT NULL);
CREATE TABLE dbo.stock_counts(
 id nvarchar(64) NOT NULL PRIMARY KEY, branchId nvarchar(64) NOT NULL REFERENCES dbo.branches(id),
 createdBy nvarchar(64) NOT NULL REFERENCES dbo.users(id), approvedBy nvarchar(64) NULL REFERENCES dbo.users(id),
 status varchar(20) NOT NULL CHECK(status IN ('draft','submitted','approved')), note nvarchar(300) NOT NULL,
 date datetime2 NOT NULL, submittedAt datetime2 NULL, approvedAt datetime2 NULL);
CREATE TABLE dbo.count_lines(
 id nvarchar(64) NOT NULL PRIMARY KEY, countId nvarchar(64) NOT NULL REFERENCES dbo.stock_counts(id),
 productId nvarchar(64) NOT NULL REFERENCES dbo.skus(id), expected int NOT NULL CHECK(expected>=0),
 counted int NOT NULL CHECK(counted>=0), revision int NOT NULL,
 devices nvarchar(max) NULL, UNIQUE(countId,productId));
CREATE TABLE dbo.request_keys(
 userId nvarchar(64) NOT NULL REFERENCES dbo.users(id), action nvarchar(200) NOT NULL, requestKey nvarchar(100) NOT NULL,
 requestHash varchar(64) NOT NULL, response nvarchar(max) NOT NULL, date datetime2 NOT NULL,
 PRIMARY KEY(userId,action,requestKey));
CREATE TABLE dbo.audit_events(
 id nvarchar(64) NOT NULL PRIMARY KEY, branchId nvarchar(64) NULL REFERENCES dbo.branches(id),
 actorId nvarchar(64) NOT NULL REFERENCES dbo.users(id), action nvarchar(120) NOT NULL,
 entityId nvarchar(64) NOT NULL, details nvarchar(max) NOT NULL, date datetime2 NOT NULL);
INSERT dbo.schema_migrations(version) VALUES(1);
COMMIT;
END;

