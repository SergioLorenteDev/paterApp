# Analisis De Muestra Documental Real Y Reglas Para La BBDD Final

Fecha del analisis: 26-02-2026  
Muestra usada: [muestra-documental-representativa.csv](muestra-documental-representativa.csv)

Este analisis se ha hecho sobre documentacion tecnica real de OEMs con descarga abierta o ficha oficial accesible. La muestra mezcla automatizacion industrial (Siemens, Schneider, Danfoss, ABB) y maquinaria pesada (Caterpillar) para no sobredisenar la base de datos hacia un solo fabricante.

## Lo Que Se Observa En Documentacion Real

Al revisar los documentos, se repite siempre el mismo patron: cada OEM tiene su forma de nombrar y versionar los manuales, pero todos mantienen una identidad documental fuerte (codigo propio del documento), un tipo funcional claro (operacion, programacion, seguridad, etc.) y un alcance de aplicabilidad (modelo, familia o variante concreta).  

Tambien se ve que no basta con guardar solo una URL y un titulo. En la practica operativa, el tecnico necesita saber si ese documento aplica exactamente a su maquina, a su firmware y a su idioma. Si eso no queda modelado desde el principio, el sistema acaba devolviendo manuales "parecidos" pero no validos para intervenir en campo.

## Campos Obligatorios Recomendados (Nucleo Estable)

Estos campos deben ser obligatorios en la entidad documental final porque aparecen de forma consistente en la muestra y son necesarios para trazabilidad:

- `document_id` interno (UUID o clave estable).
- `oem_id` (fabricante).
- `machine_model_id` (modelo/familia asociada).
- `document_type` normalizado (operator_manual, service_manual, parts_catalog, safety_bulletin, quick_guide, troubleshooting_guide, programming_manual, etc.).
- `title`.
- `source_url`.
- `source_channel` (portal_oem, biblioteca_oem, url_directa_pdf, portal_multilenguaje).
- `access_level` (public_open, public_registration, subscription, partner_only, paid).
- `language` (ISO/locale, por ejemplo `en-US`, `es-ES`).
- `is_official` (boolean).
- `ingestion_status` (pendiente, descargado, parseado, indexado, error).
- `created_at` y `updated_at`.

## Campos Muy Recomendables (Casi Obligatorios En Operacion)

Estos campos no siempre vienen en todas las fichas, pero son clave para calidad de soporte y futuro RAG:

- `oem_document_code` (ejemplos reales en la muestra: `EAV64318`, `M0085473-01`, codigos tipo `AU275...`/`3AUA...`).
- `revision` o `version`.
- `publication_date`.
- `page_count`.
- `file_format` (`pdf`, `html`, etc.).
- `checksum_sha256` y `file_size_bytes` para control de versiones reales.
- `applies_to_firmware_min` / `applies_to_firmware_max` cuando aplique.
- `serial_range_from` / `serial_range_to` cuando aplique.
- `country_or_regulatory_scope` (si hay variantes regionales).

## Reglas De Integridad Que Deben Ir A La BBDD

La evidencia de la muestra lleva a estas reglas concretas:

1. Un documento no puede existir sin fabricante ni modelo (`oem_id` y `machine_model_id` obligatorios).
2. Debe existir unicidad por fuente real para evitar duplicados:  
`UNIQUE(oem_id, oem_document_code, language, revision)` cuando hay codigo OEM, y fallback `UNIQUE(machine_model_id, source_url)` cuando no lo hay.
3. Nunca sobreescribir un documento anterior: si cambia revision o fecha, se crea nueva version y la anterior se marca como no activa (`is_active = false`).
4. El activo operativo consulta documentos por jerarquia:  
`asset -> machine_model -> documentos activos`, filtrando por idioma preferido y acceso disponible.
5. Si `access_level` no es abierto, la app debe mostrarlo explicitamente en UI antes de intentar descarga o consulta IA.

## Impacto Directo En El Diseño De Entidades

Con esta muestra, la base final no necesita rehacerse, solo consolidarse. El nucleo que ya teneis (`manufacturers`, `machine_models`, `technical_documents`, `assets`) es correcto y se debe ampliar con tres bloques:

- bloque de versionado documental (`technical_document_versions`);
- bloque de aplicabilidad (`document_applicability`) para firmware/serie/regulacion;
- bloque de auditoria de ingesta (`document_ingestion_runs`, `document_ingestion_errors`).

Asi separas bien el "que documento es" del "archivo concreto que cargaste hoy" y del "para que variantes sirve".

## Recomendacion De Ejecucion (Antes De IA)

La siguiente fase debe centrarse en ingestion robusta, no en prompts. Primero se estabiliza la verdad documental en base de datos, luego se indexa para RAG.

El orden practico recomendado:

1. Importador CSV/JSON con validaciones de campos obligatorios.
2. Descarga controlada de documentos y hash del archivo.
3. Registro de versiones y activacion/desactivacion.
4. Exposicion API por activo/modelo con filtro de idioma y tipo.
5. Solo entonces, chunking e indexacion vectorial para IA.

Con este enfoque, cuando llegue la capa de IA, ya no "adivina": responde sobre una base documental trazable y auditada.
