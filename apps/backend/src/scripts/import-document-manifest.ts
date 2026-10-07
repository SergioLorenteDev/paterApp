import { DocumentAccessLevel, DocumentType, PrismaClient } from '@prisma/client';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

type CsvRow = Record<string, string>;

const prisma = new PrismaClient();

function parseCsv(content: string): CsvRow[] {
  const rows: string[][] = [];
  let currentField = '';
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      currentField += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentField);
      currentField = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i += 1;
      }

      currentRow.push(currentField);
      if (currentRow.some((value) => value.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
      continue;
    }

    currentField += char;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((value) => value.trim().length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((row) => {
    const parsed: CsvRow = {};
    headers.forEach((header, index) => {
      parsed[header] = (row[index] ?? '').trim();
    });
    return parsed;
  });
}

function toManufacturerId(name: string): string {
  return `MFG-${name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;
}

function toMachineModelId(manufacturerId: string, modelCode: string): string {
  const sanitized = modelCode.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `MM-${manufacturerId.replace('MFG-', '')}-${sanitized}`;
}

function mapDocumentType(rawType: string): DocumentType {
  const map: Record<string, DocumentType> = {
    operator_manual: 'operator_manual',
    service_manual: 'service_manual',
    parts_catalog: 'parts_catalog',
    troubleshooting_guide: 'troubleshooting_guide',
    safety_bulletin: 'safety_bulletin',
    quick_guide: 'quick_guide',
    functional_safety_manual: 'functional_safety_manual',
    system_manual: 'system_manual',
    programming_manual: 'programming_manual',
    installation_manual: 'installation_manual',
    programming_guide: 'programming_guide',
    design_guide: 'design_guide',
    operating_guide: 'operating_guide',
    firmware_manual: 'firmware_manual',
    manual_index: 'manual_index',
    operation_maintenance_manual: 'operation_maintenance_manual',
    operation_maintenance_portal: 'operation_maintenance_portal',
    service_access_policy: 'service_access_policy',
  };

  const resolved = map[rawType];
  if (!resolved) {
    throw new Error(`Tipo documental no soportado: ${rawType}`);
  }
  return resolved;
}

function mapAccessLevel(rawAccess: string): DocumentAccessLevel {
  const map: Record<string, DocumentAccessLevel> = {
    public_open: 'public_open',
    public_registration: 'public_registration',
    partner_restricted: 'partner_restricted',
    paid: 'paid',
    subscription: 'subscription',
    'public_open+subscription': 'mixed',
    mixed: 'mixed',
  };

  return map[rawAccess] ?? 'public_open';
}

function mapFileFormat(rawFormat: string): string {
  if (rawFormat === 'pagina_html') {
    return 'html';
  }
  return rawFormat || 'pdf';
}

function parseDateOrNull(value: string): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parsePageCount(value: string): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

async function run() {
  const manifestArg = process.argv[2] ?? '../../docs/muestra-documental-representativa.csv';
  const manifestPath = resolve(process.cwd(), manifestArg);
  const content = await readFile(manifestPath, 'utf8');
  const rows = parseCsv(content);

  if (rows.length === 0) {
    throw new Error(`No hay filas en el manifiesto: ${manifestPath}`);
  }

  let importedCount = 0;

  for (const row of rows) {
    const manufacturerName = row.oem;
    const modelCode = row.modelo_o_equipo;
    const modelName = row.familia_modelo
      ? `${row.familia_modelo} ${row.modelo_o_equipo}`.trim()
      : row.modelo_o_equipo;

    if (!manufacturerName || !modelCode || !row.document_id || !row.tipo_documento || !row.url_fuente) {
      // Saltamos filas incompletas para no romper la carga completa.
      // Se prioriza trazabilidad con mensaje claro.
      // eslint-disable-next-line no-console
      console.warn(`Fila incompleta omitida: ${JSON.stringify(row)}`);
      continue;
    }

    const manufacturerId = toManufacturerId(manufacturerName);
    const machineModelId = toMachineModelId(manufacturerId, modelCode);
    const documentType = mapDocumentType(row.tipo_documento);
    const accessLevel = mapAccessLevel(row.acceso);

    await prisma.manufacturer.upsert({
      where: { id: manufacturerId },
      update: {
        name: manufacturerName,
      },
      create: {
        id: manufacturerId,
        name: manufacturerName,
      },
    });

    // Importante: reutilizamos el id que devuelve el upsert.
    // Si el modelo ya existia con otro id (por ejemplo, cargado desde db/init/001_init.sql),
    // el upsert actualiza esa fila y conserva su id original; usar el id calculado
    // rompería la clave foranea del documento.
    const machineModel = await prisma.machineModel.upsert({
      where: {
        manufacturerId_code: {
          manufacturerId,
          code: modelCode,
        },
      },
      update: {
        name: modelName,
        family: row.familia_modelo || null,
      },
      create: {
        id: machineModelId,
        manufacturerId,
        code: modelCode,
        name: modelName,
        family: row.familia_modelo || null,
      },
    });

    const resolvedMachineModelId = machineModel.id;

    await prisma.technicalDocument.upsert({
      where: { id: row.document_id },
      update: {
        machineModelId: resolvedMachineModelId,
        title: row.titulo || row.document_id,
        documentType,
        language: row.idioma || 'en-US',
        sourceUrl: row.url_fuente,
        fileFormat: mapFileFormat(row.formato),
        revision: row.version_revision || null,
        publicationDate: parseDateOrNull(row.fecha_publicacion),
        pageCount: parsePageCount(row.paginas),
        accessLevel,
        isOfficial: true,
        isActive: true,
      },
      create: {
        id: row.document_id,
        machineModelId: resolvedMachineModelId,
        title: row.titulo || row.document_id,
        documentType,
        language: row.idioma || 'en-US',
        sourceUrl: row.url_fuente,
        fileFormat: mapFileFormat(row.formato),
        revision: row.version_revision || null,
        publicationDate: parseDateOrNull(row.fecha_publicacion),
        pageCount: parsePageCount(row.paginas),
        accessLevel,
        keywords: [],
      },
    });

    importedCount += 1;
  }

  // eslint-disable-next-line no-console
  console.log(`Importacion completada: ${importedCount} documentos procesados.`);
}

run()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Error en importacion de manifiesto documental:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
