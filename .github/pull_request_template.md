## Cambio

Describe el problema, el comportamiento resultante y el riesgo principal.

## Verificación

Indica los comandos ejecutados y sus resultados. Los controles afectados deben pasar sin errores ni avisos; un control sin ejecutar no cuenta como aprobado.

## Revisión de calidad

Identifica el commit o estado del diff revisado y quién realizó la revisión independiente. Para cambios solo de documentación basta una autorrevisión.

Explica qué contratos o implementaciones existentes se reutilizan y justifica las nuevas abstracciones. Registra los hallazgos, su corrección y la comprobación correspondiente; si no hubo hallazgos, deja un veredicto explícito.

- [ ] El diff completo responde al problema y no incluye cambios ajenos.
- [ ] No añade contratos duplicados, capas innecesarias, estado derivable ni fallbacks que oculten errores.
- [ ] La lógica y las correcciones están en la capa responsable; permisos, ventana del evento y consumidores mantienen sus contratos.
- [ ] Todos los hallazgos bloqueantes están resueltos y la revisión corresponde al diff final.
- [ ] Los controles de calidad afectados pasan sin rebajar reglas, añadir exclusiones ni posponer defectos introducidos.
