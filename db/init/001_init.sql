-- Tipos enumerados alineados con el esquema de Prisma (apps/backend/prisma/schema.prisma).
-- Se crean antes de las tablas para que las columnas usen el mismo tipo en BBDD y en la app.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN
    CREATE TYPE "UserRole" AS ENUM ('technician', 'manager', 'commercial');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AssetStatus') THEN
    CREATE TYPE "AssetStatus" AS ENUM ('active', 'inactive', 'retired');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CaseSeverity') THEN
    CREATE TYPE "CaseSeverity" AS ENUM ('low', 'medium', 'high', 'critical');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CaseStatus') THEN
    CREATE TYPE "CaseStatus" AS ENUM ('open', 'in_progress', 'blocked', 'closed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WorkOrderKind') THEN
    CREATE TYPE "WorkOrderKind" AS ENUM ('corrective', 'preventive', 'inspection');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WorkOrderOutcome') THEN
    CREATE TYPE "WorkOrderOutcome" AS ENUM ('pending', 'resolved', 'escalated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DocumentType') THEN
    CREATE TYPE "DocumentType" AS ENUM (
      'operator_manual',
      'service_manual',
      'parts_catalog',
      'troubleshooting_guide',
      'safety_bulletin',
      'quick_guide',
      'functional_safety_manual',
      'system_manual',
      'programming_manual',
      'installation_manual',
      'programming_guide',
      'design_guide',
      'operating_guide',
      'firmware_manual',
      'manual_index',
      'operation_maintenance_manual',
      'operation_maintenance_portal',
      'service_access_policy'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DocumentAccessLevel') THEN
    CREATE TYPE "DocumentAccessLevel" AS ENUM (
      'public_open', 'public_registration', 'partner_restricted', 'paid', 'subscription', 'mixed'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DocumentIngestionStatus') THEN
    CREATE TYPE "DocumentIngestionStatus" AS ENUM ('pending', 'downloaded', 'parsed', 'failed');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sector TEXT,
  region TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  role "UserRole" NOT NULL,
  region TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  serial_number TEXT NOT NULL UNIQUE,
  model TEXT NOT NULL,
  status "AssetStatus" NOT NULL,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  machine_model_id TEXT,
  location TEXT,
  installed_at DATE,
  warranty_end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES assets(id),
  severity "CaseSeverity" NOT NULL,
  status "CaseStatus" NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ,
  root_cause TEXT,
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS work_orders (
  id TEXT PRIMARY KEY,
  case_id TEXT REFERENCES cases(id),
  asset_id TEXT NOT NULL REFERENCES assets(id),
  technician_id TEXT REFERENCES users(id),
  kind "WorkOrderKind" NOT NULL,
  worked_hours NUMERIC(6, 2),
  outcome "WorkOrderOutcome" NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS manufacturers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  website_url TEXT,
  country_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS machine_models (
  id TEXT PRIMARY KEY,
  manufacturer_id TEXT NOT NULL REFERENCES manufacturers(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  family TEXT,
  description TEXT,
  released_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (manufacturer_id, code)
);

CREATE TABLE IF NOT EXISTS technical_documents (
  id TEXT PRIMARY KEY,
  machine_model_id TEXT NOT NULL REFERENCES machine_models(id),
  title TEXT NOT NULL,
  document_type "DocumentType" NOT NULL,
  language TEXT NOT NULL DEFAULT 'es-ES',
  source_url TEXT NOT NULL,
  file_format TEXT NOT NULL DEFAULT 'pdf',
  revision TEXT,
  publication_date DATE,
  page_count INTEGER,
  access_level "DocumentAccessLevel" NOT NULL DEFAULT 'public_open',
  is_official BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ingestion_status "DocumentIngestionStatus" NOT NULL DEFAULT 'pending',
  local_file_path TEXT,
  extraction_method TEXT,
  extracted_text TEXT,
  last_ingested_at TIMESTAMPTZ,
  ingestion_error TEXT,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS technical_document_chunks (
  id TEXT PRIMARY KEY,
  technical_document_id TEXT NOT NULL REFERENCES technical_documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  char_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (technical_document_id, chunk_index)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'assets'
      AND column_name = 'machine_model_id'
  ) THEN
    ALTER TABLE assets ADD COLUMN machine_model_id TEXT;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'technical_documents'
      AND column_name = 'ingestion_status'
  ) THEN
    ALTER TABLE technical_documents
      ADD COLUMN ingestion_status TEXT NOT NULL DEFAULT 'pending';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'technical_documents'
      AND column_name = 'local_file_path'
  ) THEN
    ALTER TABLE technical_documents ADD COLUMN local_file_path TEXT;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'technical_documents'
      AND column_name = 'extraction_method'
  ) THEN
    ALTER TABLE technical_documents ADD COLUMN extraction_method TEXT;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'technical_documents'
      AND column_name = 'extracted_text'
  ) THEN
    ALTER TABLE technical_documents ADD COLUMN extracted_text TEXT;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'technical_documents'
      AND column_name = 'last_ingested_at'
  ) THEN
    ALTER TABLE technical_documents ADD COLUMN last_ingested_at TIMESTAMPTZ;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'technical_documents'
      AND column_name = 'ingestion_error'
  ) THEN
    ALTER TABLE technical_documents ADD COLUMN ingestion_error TEXT;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'technical_documents_ingestion_status_check'
  ) THEN
    ALTER TABLE technical_documents
      ADD CONSTRAINT technical_documents_ingestion_status_check
      CHECK (ingestion_status IN ('pending', 'downloaded', 'parsed', 'failed'));
  END IF;
END$$;

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'technical_documents'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%document_type%'
  LOOP
    EXECUTE format('ALTER TABLE technical_documents DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'technical_documents_document_type_check'
  ) THEN
    ALTER TABLE technical_documents
      ADD CONSTRAINT technical_documents_document_type_check
      CHECK (
        document_type IN (
          'operator_manual',
          'service_manual',
          'parts_catalog',
          'troubleshooting_guide',
          'safety_bulletin',
          'quick_guide',
          'functional_safety_manual',
          'system_manual',
          'programming_manual',
          'installation_manual',
          'programming_guide',
          'design_guide',
          'operating_guide',
          'firmware_manual',
          'manual_index',
          'operation_maintenance_manual',
          'operation_maintenance_portal',
          'service_access_policy'
        )
      );
  END IF;
END$$;

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'technical_documents'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%access_level%'
  LOOP
    EXECUTE format('ALTER TABLE technical_documents DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'technical_documents_access_level_check'
  ) THEN
    ALTER TABLE technical_documents
      ADD CONSTRAINT technical_documents_access_level_check
      CHECK (
        access_level IN ('public_open', 'public_registration', 'partner_restricted', 'paid', 'subscription', 'mixed')
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'assets_machine_model_id_fkey'
  ) THEN
    ALTER TABLE assets
      ADD CONSTRAINT assets_machine_model_id_fkey
      FOREIGN KEY (machine_model_id) REFERENCES machine_models(id);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_assets_customer_id ON assets(customer_id);
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'assets'
      AND column_name = 'machine_model_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_assets_machine_model_id ON assets(machine_model_id);
  END IF;
END$$;
CREATE INDEX IF NOT EXISTS idx_cases_asset_id ON cases(asset_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_asset_id ON work_orders(asset_id);
CREATE INDEX IF NOT EXISTS idx_machine_models_manufacturer_id ON machine_models(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_technical_documents_machine_model_id ON technical_documents(machine_model_id);
CREATE INDEX IF NOT EXISTS idx_technical_documents_document_type ON technical_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_technical_documents_language ON technical_documents(language);
CREATE INDEX IF NOT EXISTS idx_technical_document_chunks_document_id ON technical_document_chunks(technical_document_id);

INSERT INTO customers (id, name, sector, region)
VALUES
  ('CUST-301', 'MetalWorks Iberia', 'Industrial Manufacturing', 'ES-EAST')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, full_name, role, region)
VALUES
  ('TECH-45', 'Laura Torres', 'technician', 'ES-EAST'),
  ('MGR-12', 'Carlos Ruiz', 'manager', 'ES-EAST')
ON CONFLICT (id) DO NOTHING;

INSERT INTO manufacturers (id, name, website_url, country_code)
VALUES
  ('MFG-SIEMENS', 'Siemens', 'https://www.siemens.com', 'DE'),
  ('MFG-ABB', 'ABB', 'https://new.abb.com', 'CH'),
  ('MFG-SCHNEIDER', 'Schneider Electric', 'https://www.se.com', 'FR'),
  ('MFG-DANFOSS', 'Danfoss', 'https://www.danfoss.com', 'DK'),
  ('MFG-CATERPILLAR', 'Caterpillar', 'https://www.cat.com', 'US')
ON CONFLICT (id) DO NOTHING;

INSERT INTO machine_models (id, manufacturer_id, code, name, family, description, released_at)
VALUES
  ('MM-SI-G120', 'MFG-SIEMENS', 'SINAMICS-G120', 'Variador SINAMICS G120', 'SINAMICS', 'Variador de frecuencia industrial modular para automatizacion y bombeo.', '2018-01-01'),
  ('MM-SI-S71200', 'MFG-SIEMENS', 'S7-1200', 'PLC SIMATIC S7-1200', 'SIMATIC', 'Controlador logico programable modular para automatizacion industrial.', '2014-01-01'),
  ('MM-ABB-ACS880', 'MFG-ABB', 'ACS880', 'Variador ABB ACS880', 'ACS', 'Variador de proposito general para procesos industriales de alto rendimiento.', '2016-01-01'),
  ('MM-ABB-ACS880-N5700', 'MFG-ABB', 'ACS880-N5700', 'ACS880 Position Control Program', 'ACS880', 'Programa de control de posicion para familia ACS880.', '2019-01-01'),
  ('MM-SE-ATV630', 'MFG-SCHNEIDER', 'ATV630', 'Altivar Process ATV630', 'Altivar Process', 'Variador para aplicaciones de bombas, ventiladores y control de proceso.', '2017-01-01'),
  ('MM-SE-ATV600', 'MFG-SCHNEIDER', 'ATV600', 'Altivar Process ATV600', 'Altivar Process', 'Variador de proceso con enfoque en eficiencia energetica y robustez operativa.', '2017-01-01'),
  ('MM-SE-ATV630-650', 'MFG-SCHNEIDER', 'ATV630-650', 'Altivar Process ATV630-650', 'Altivar Process', 'Rango de variadores ATV630 a ATV650 con requisitos de instalacion especificos.', '2017-01-01'),
  ('MM-DF-FC301-302', 'MFG-DANFOSS', 'FC301-302', 'VLT AutomationDrive FC 301/302', 'VLT AutomationDrive', 'Variadores de frecuencia para aplicaciones industriales avanzadas.', '2015-01-01'),
  ('MM-DF-FC302', 'MFG-DANFOSS', 'FC-302', 'VLT AutomationDrive FC 302', 'VLT AutomationDrive', 'Variador con funciones avanzadas de control de motor y comunicaciones industriales.', '2015-01-01'),
  ('MM-CAT-CORP-RADIO', 'MFG-CATERPILLAR', 'CORPORATE-RADIO', 'Corporate Radio Product Link', 'Product Link', 'Componente de comunicacion y soporte de operacion para equipos Caterpillar.', '2017-01-01'),
  ('MM-CAT-SIS2GO', 'MFG-CATERPILLAR', 'SIS2GO', 'SIS2GO Documentation Access', 'SIS2GO', 'Canal de acceso a manuales y contenido tecnico de servicio para maquinaria Cat.', '2020-01-01')
ON CONFLICT (manufacturer_id, code) DO NOTHING;

INSERT INTO assets (id, serial_number, model, status, customer_id, machine_model_id, location, installed_at, warranty_end_date)
VALUES
  ('AST-1001', 'SN-778821', 'HydraPress X4', 'active', 'CUST-301', 'MM-SI-G120', 'Valencia Plant 2', '2025-04-18', '2027-04-18'),
  ('AST-1002', 'SN-778822', 'HydraPress X4', 'active', 'CUST-301', 'MM-SI-G120', 'Valencia Plant 1', '2025-03-10', '2027-03-10'),
  ('AST-1003', 'SN-778823', 'HydraPress X4', 'inactive', 'CUST-301', 'MM-SI-G120', 'Valencia Plant 3', '2024-11-18', '2026-11-18'),
  ('AST-1004', 'SN-889101', 'SIMATIC LineCtrl', 'active', 'CUST-301', 'MM-SI-S71200', 'Bilbao Plant 2', '2023-09-02', '2026-09-02'),
  ('AST-1005', 'SN-889102', 'SIMATIC LineCtrl', 'active', 'CUST-301', 'MM-SI-S71200', 'Sevilla Plant 1', '2022-06-14', '2025-06-14'),
  ('AST-1006', 'SN-990201', 'ABB DrivePack', 'active', 'CUST-301', 'MM-ABB-ACS880', 'Madrid Plant 1', '2024-01-20', '2027-01-20'),
  ('AST-1007', 'SN-990202', 'ABB DrivePack', 'retired', 'CUST-301', 'MM-ABB-ACS880', 'Madrid Plant 2', '2019-04-11', '2022-04-11'),
  ('AST-1008', 'SN-990301', 'ABB Position Unit', 'active', 'CUST-301', 'MM-ABB-ACS880-N5700', 'Murcia Plant 1', '2021-07-09', '2024-07-09'),
  ('AST-1009', 'SN-772401', 'Altivar Process Node', 'active', 'CUST-301', 'MM-SE-ATV630', 'Zaragoza Plant 1', '2025-01-05', '2028-01-05'),
  ('AST-1010', 'SN-772402', 'Altivar Process Node', 'inactive', 'CUST-301', 'MM-SE-ATV630', 'Zaragoza Plant 2', '2023-12-01', '2026-12-01'),
  ('AST-1011', 'SN-772501', 'Altivar Process Edge', 'active', 'CUST-301', 'MM-SE-ATV600', 'A Coruna Plant 1', '2024-05-22', '2027-05-22'),
  ('AST-1012', 'SN-772601', 'Altivar Process Range', 'active', 'CUST-301', 'MM-SE-ATV630-650', 'Alicante Plant 1', '2022-10-10', '2025-10-10'),
  ('AST-1013', 'SN-663701', 'Danfoss VLT Core', 'active', 'CUST-301', 'MM-DF-FC302', 'Valencia Plant 4', '2021-02-17', '2024-02-17'),
  ('AST-1014', 'SN-663702', 'Danfoss VLT Core', 'retired', 'CUST-301', 'MM-DF-FC302', 'Valencia Plant 5', '2018-08-30', '2021-08-30'),
  ('AST-1015', 'SN-663801', 'Danfoss VLT Suite', 'active', 'CUST-301', 'MM-DF-FC301-302', 'Bilbao Plant 1', '2025-02-02', '2028-02-02'),
  ('AST-1016', 'SN-554901', 'Cat Radio Link', 'active', 'CUST-301', 'MM-CAT-CORP-RADIO', 'Malaga Plant 1', '2023-03-19', '2026-03-19'),
  ('AST-1017', 'SN-554902', 'Cat Radio Link', 'inactive', 'CUST-301', 'MM-CAT-CORP-RADIO', 'Malaga Plant 2', '2020-01-07', '2023-01-07'),
  ('AST-1018', 'SN-555001', 'Cat SIS Access Node', 'active', 'CUST-301', 'MM-CAT-SIS2GO', 'Cadiz Plant 1', '2024-09-13', '2027-09-13')
ON CONFLICT (id) DO UPDATE
SET machine_model_id = EXCLUDED.machine_model_id;

INSERT INTO technical_documents (
  id,
  machine_model_id,
  title,
  document_type,
  language,
  source_url,
  file_format,
  revision,
  publication_date,
  page_count,
  access_level,
  keywords
)
VALUES
  (
    'DOC-SI-G120-OM-001',
    'MM-SI-G120',
    'SINAMICS G120 - Operating Instructions',
    'operator_manual',
    'en-US',
    'https://support.industry.siemens.com/cs/document/109478699',
    'pdf',
    'v4',
    '2023-01-01',
    NULL,
    'public_open',
    ARRAY['sinamics', 'g120', 'commissioning', 'safety']
  ),
  (
    'DOC-SI-G120-QG-001',
    'MM-SI-G120',
    'SINAMICS G120 - Quick Start Guide',
    'quick_guide',
    'en-US',
    'https://support.industry.siemens.com',
    'pdf',
    NULL,
    NULL,
    NULL,
    'public_open',
    ARRAY['sinamics', 'quick-start', 'setup']
  ),
  (
    'DOC-ABB-ACS880-OM-001',
    'MM-ABB-ACS880',
    'ACS880 Drives - Firmware Manual',
    'operator_manual',
    'en-US',
    'https://library.abb.com',
    'pdf',
    NULL,
    NULL,
    NULL,
    'public_open',
    ARRAY['acs880', 'firmware', 'diagnostics']
  ),
  (
    'DOC-SE-ATV630-OM-001',
    'MM-SE-ATV630',
    'Altivar Process ATV630 - Programming Manual',
    'operator_manual',
    'en-US',
    'https://www.se.com/us/en/download/',
    'pdf',
    NULL,
    NULL,
    NULL,
    'public_open',
    ARRAY['altivar', 'atv630', 'programming', 'fault-codes']
  ),
  (
    'DOC-DF-FC302-OM-001',
    'MM-DF-FC302',
    'VLT AutomationDrive FC 302 - Design Guide',
    'operator_manual',
    'en-US',
    'https://www.danfoss.com/en-us/products/dds/low-voltage-drives/vlt-drives/vlt-automationdrive-fc-301-fc-302/',
    'pdf',
    NULL,
    NULL,
    NULL,
    'public_open',
    ARRAY['vlt', 'fc302', 'design', 'maintenance']
  ),
  (
    'DOC-SMPL-001',
    'MM-SI-S71200',
    'S7-1200 Functional Safety Manual',
    'functional_safety_manual',
    'en-US',
    'https://support.industry.siemens.com/dl/files/552/104547552/att_896075/v1/s71200_f_user_manual_en-US_en-US.pdf',
    'pdf',
    'V4.6',
    NULL,
    215,
    'public_open',
    ARRAY['s7-1200', 'functional-safety', 'manual']
  ),
  (
    'DOC-SMPL-002',
    'MM-SI-S71200',
    'S7-1200 Programmable Controller System Manual',
    'system_manual',
    'en-US',
    'https://support.industry.siemens.com/cs/attachments/109814829/s71200_system_manual_en-US_en-US.pdf',
    'pdf',
    NULL,
    NULL,
    NULL,
    'public_open',
    ARRAY['s7-1200', 'system-manual', 'diagnostics']
  ),
  (
    'DOC-SMPL-003',
    'MM-SE-ATV600',
    'ATV600 Programming Manual',
    'programming_manual',
    'en',
    'https://www.se.com/id/en/download/document/EAV64318/',
    'pdf',
    '13',
    '2025-10-27',
    NULL,
    'public_open',
    ARRAY['atv600', 'programming', 'manual']
  ),
  (
    'DOC-SMPL-004',
    'MM-SE-ATV630-650',
    'ATV630-650 Installation Manual',
    'installation_manual',
    'en',
    'https://www.se.com/us/en/download/document/EAV64301/',
    'pdf',
    '13',
    '2025-07-04',
    NULL,
    'public_open',
    ARRAY['atv630-650', 'installation', 'manual']
  ),
  (
    'DOC-SMPL-005',
    'MM-DF-FC301-302',
    'VLT AutomationDrive FC 301/FC 302 Programming Guide',
    'programming_guide',
    'en',
    'https://assets.danfoss.com/documents/569514/AU275636650261en-003301.pdf',
    'pdf',
    'AU275636650261en-003301',
    '2026-02-04',
    862,
    'public_open',
    ARRAY['fc301', 'fc302', 'programming-guide']
  ),
  (
    'DOC-SMPL-006',
    'MM-DF-FC302',
    'VLT AutomationDrive FC 302 Design Guide',
    'design_guide',
    'en',
    'https://assets.danfoss.com/documents/272559/AJ317025801074en-000101.pdf',
    'pdf',
    'AJ317025801074en-000101',
    '2019-09-15',
    234,
    'public_open',
    ARRAY['fc302', 'design-guide']
  ),
  (
    'DOC-SMPL-007',
    'MM-DF-FC302',
    'VLT AutomationDrive FC 302 Operating Guide',
    'operating_guide',
    'en',
    'https://assets.danfoss.com/documents/272438/AQ361180580249en-000801.pdf',
    'pdf',
    'AQ361180580249en-000801',
    '2013-12-16',
    124,
    'public_open',
    ARRAY['fc302', 'operating-guide']
  ),
  (
    'DOC-SMPL-008',
    'MM-ABB-ACS880-N5700',
    'ACS880 Position Control Program Firmware Manual',
    'firmware_manual',
    'en',
    'https://library.e.abb.com/public/111035b3f62f473494e8f6e87da73b66/EN_ACS880_Position_ctrl_prg_N5700_FW_manual_B_A4.pdf',
    'pdf',
    'B',
    NULL,
    662,
    'public_open',
    ARRAY['acs880', 'firmware', 'position-control']
  ),
  (
    'DOC-SMPL-009',
    'MM-ABB-ACS880',
    'ACS880 Multidrive Module Manuals (Index)',
    'manual_index',
    'multiple',
    'https://www.abb.com/global/en/areas/motion/drives/low-voltage-ac-drives/industrial-drives/acs880-multidrives',
    'html',
    NULL,
    '2024-03-08',
    NULL,
    'public_open',
    ARRAY['acs880', 'manual-index', 'multidrive']
  ),
  (
    'DOC-SMPL-010',
    'MM-CAT-CORP-RADIO',
    'Corporate Radio Operation and Maintenance Manual (en-us)',
    'operation_maintenance_manual',
    'en-US',
    'https://s7d2.scene7.com/is/content/Caterpillar/CM20170914-73146-42882',
    'pdf',
    'M0085473-01',
    NULL,
    28,
    'public_open',
    ARRAY['caterpillar', 'operation', 'maintenance']
  ),
  (
    'DOC-SMPL-011',
    'MM-CAT-CORP-RADIO',
    'Corporate Radio Operation and Maintenance Manuals (Portal)',
    'operation_maintenance_portal',
    'multiple',
    'https://www.cat.com/en_US/support/operations/technology/product-link-owners-manuals/radioownersmanual/caterpillar-corporate-radio-operation-and-maintenance-manuals.html',
    'html',
    'M0085473-01',
    NULL,
    NULL,
    'public_open',
    ARRAY['caterpillar', 'portal', 'multi-language']
  ),
  (
    'DOC-SMPL-012',
    'MM-CAT-SIS2GO',
    'SIS2GO Access to Manuals and Service Content',
    'service_access_policy',
    'en-US',
    'https://www.cat.com/en_US/articles/for-owners/get-parts-and-service-manuals-fast-with-sis2go-app.html',
    'html',
    NULL,
    NULL,
    NULL,
    'mixed',
    ARRAY['sis2go', 'subscription', 'access-policy']
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO cases (id, asset_id, severity, status, opened_at, root_cause)
VALUES
  ('CASE-5001', 'AST-1001', 'high', 'open', '2026-02-20T09:15:00Z', 'Pending diagnosis')
ON CONFLICT (id) DO NOTHING;

INSERT INTO work_orders (id, case_id, asset_id, technician_id, kind, worked_hours, outcome)
VALUES
  ('WO-9001', 'CASE-5001', 'AST-1001', 'TECH-45', 'corrective', 2.50, 'pending')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE VIEW kpi_document_ingestion_global AS
SELECT
  count(*)::INTEGER AS total_documents,
  count(*) FILTER (WHERE ingestion_status = 'parsed')::INTEGER AS parsed_documents,
  count(*) FILTER (WHERE ingestion_status = 'downloaded')::INTEGER AS downloaded_documents,
  count(*) FILTER (WHERE ingestion_status = 'pending')::INTEGER AS pending_documents,
  count(*) FILTER (WHERE ingestion_status = 'failed')::INTEGER AS failed_documents,
  round(
    (
      count(*) FILTER (WHERE ingestion_status = 'parsed')::NUMERIC
      / NULLIF(count(*)::NUMERIC, 0)
    ) * 100,
    2
  ) AS parsed_coverage_pct
FROM technical_documents;

CREATE OR REPLACE VIEW kpi_document_ingestion_by_model AS
SELECT
  m.name AS manufacturer_name,
  mm.id AS machine_model_id,
  mm.name AS machine_model_name,
  count(td.id)::INTEGER AS total_documents,
  count(td.id) FILTER (WHERE td.ingestion_status = 'parsed')::INTEGER AS parsed_documents,
  count(td.id) FILTER (WHERE td.ingestion_status = 'downloaded')::INTEGER AS downloaded_documents,
  count(td.id) FILTER (WHERE td.ingestion_status = 'pending')::INTEGER AS pending_documents,
  count(td.id) FILTER (WHERE td.ingestion_status = 'failed')::INTEGER AS failed_documents,
  round(
    (
      count(td.id) FILTER (WHERE td.ingestion_status = 'parsed')::NUMERIC
      / NULLIF(count(td.id)::NUMERIC, 0)
    ) * 100,
    2
  ) AS parsed_coverage_pct
FROM machine_models mm
JOIN manufacturers m
  ON m.id = mm.manufacturer_id
LEFT JOIN technical_documents td
  ON td.machine_model_id = mm.id
GROUP BY m.name, mm.id, mm.name;
