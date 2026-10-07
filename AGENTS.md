# Contexto Del Agente Primario De PaterApp

## Mision
Construir y evolucionar una web app responsive (mobile-first) para equipos industriales de postventa.
La app debe mejorar el acceso operativo a los datos, la visibilidad de KPIs y la velocidad de ejecucion en campo.
No sustituye Salesforce; lo complementa.

## Alcance De Producto
- Punto de entrada principal: escaneo QR en maquina/componente.
- Salidas principales: estado de maquina, historial tecnico, contexto de cliente y KPIs accionables.
- Usuarios principales: tecnico de campo, responsable de servicio y perfil comercial/gestor de cuenta.

## Limites Del Sistema
- Salesforce es el sistema fuente cuando este disponible.
- PaterApp es la capa de experiencia y analitica.
- No modelar la app como un clon 1:1 de Salesforce.

## Arquitectura Base
- Frontend: Next.js web app responsive (mobile-first).
- Backend: API REST en NestJS con control de acceso por roles.
- Base de datos: PostgreSQL.
- Jobs asincronos: BullMQ + Redis para importaciones y materializacion de metricas.
- Ingestion: conector agnostico de proveedor (`CSV` ahora, API de Salesforce despues).
- Modulo de IA: servicio opcional y aislado del nucleo transaccional.

## Principios Tecnicos
- Mantener un contrato de dominio estable en backend; cambiar proveedores de datos detras de adaptadores.
- Construir el MVP con entidades minimas requeridas:
  activos, clientes, casos, ordenes de trabajo, repuestos, contratos/SLA y usuarios/roles.
- Empezar con monolito modular; evitar microservicios prematuros.
- Forzar trazabilidad de auditoria en acciones de usuario y cambios de datos.

## Principios De UX
- Diseno responsive mobile-first.
- Pantallas orientadas a tarea (maximo 3 acciones primarias por vista).
- Flujo QR-first: escanear -> identificar -> decidir -> actuar.
- Semantica de estado clara: criticidad, riesgo de SLA y siguiente accion pendiente.

## IA En El Producto
- La IA asiste; la persona decide.
- Toda recomendacion debe mostrar su contexto/fuente.
- Usar IA primero para:
  resumen de historial de incidencias,
  sugerencia de siguiente accion,
  busqueda tecnica asistida sobre manuales y casos previos.

## Plan De Entrega Por Defecto
- Empezar con un MVP de 6-8 semanas.
- Priorizar:
  1) QR + ficha de maquina
  2) flujo de casos/ordenes de trabajo
  3) dashboard de KPIs (MTTR, first-time-fix, cumplimiento SLA, fallos repetidos)
- Validar con usuarios piloto antes de escalar.

## Roadmap Por Prioridad (Sin Sprints)
### Ahora (Imprescindible)
- Definir contrato de datos MVP (campos minimos por entidad).
- Implementar autenticacion y roles (tecnico, manager, comercial).
- Implementar flujo de escaneo QR y pagina de ficha de maquina.
- Implementar lectura/actualizacion esencial de casos y ordenes de trabajo.
- Implementar pipeline de ingestion CSV (importacion manual) con logs de validacion.

### Despues (Alto Impacto)
- Anadir busqueda global (activo, serie, cliente, caso).
- Anadir dashboard de KPIs (MTTR, cumplimiento SLA, first-time-fix, fallos repetidos).
- Anadir vistas de auditoria para trazabilidad operativa.
- Mejorar calidad UX en movil para campo (latencia, claridad, estados vacios y errores).

### Mas Adelante (Escala)
- Sustituir/extender ingestion CSV con conector API Salesforce.
- Anadir asistente IA v1 (resumen historico + siguiente accion + fuentes citadas).
- Anadir senales predictivas de riesgo (recurrencia de fallos y riesgo de incumplimiento SLA).
- Anadir hardening enterprise (SSO profundo, observabilidad avanzada y politicas de rate limit).

### Regla De Trabajo
- Trabajar de arriba abajo por seccion del roadmap.
- No iniciar un item de menor prioridad si hay bloqueos sin resolver en la seccion actual.
- Reordenar solo cuando cambie una dependencia o prioridad de negocio de forma explicita.

## Reglas De Colaboracion
- Explicar tradeoffs y elegir implementaciones practicas.
- Si el acceso a datos esta bloqueado, continuar con datos sinteticos + ruta de ingestion CSV.
- Mantener decisiones explicitas y listas para ejecutar.
- Al escribir o modificar codigo, explicar siempre los cambios con enfoque didactico, como para un alumno que esta aprendiendo programacion.
- Priorizar explicaciones mas entendibles y comprensivas, en lenguaje natural y cercano.
- Evitar por defecto respuestas en formato lista para las explicaciones didacticas; usar una narrativa clara paso a paso y solo listar cuando realmente ayude a no generar confusion.

## Politica De Idioma Y Localizacion
- Comunicarse siempre en espanol con el usuario.
- Desarrollar la app en espanol por defecto (UI, mensajes, formularios, ayuda y dashboards).
- Tratar Espana como locale por defecto para decisiones de formato y contenido:
  - idioma: `es-ES`
  - formato de fecha/hora y numeros: convenciones espanolas.
- Si una integracion externa exige nombres tecnicos en ingles a nivel interno, mantenerlos en backend y exponer etiquetas en espanol en la UI.
