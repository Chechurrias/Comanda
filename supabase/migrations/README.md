# Aplicar activación y autenticación de consola

1. Haz un respaldo verificable de Supabase y aplica `202610290001_atomic_tenant_activation.sql` primero en un proyecto de prueba.
2. Revisa y prueba las funciones de activación antes de aplicarlas a producción. La migración se detiene si encuentra códigos de emparejamiento duplicados o más de una licencia activa por tenant.
3. Si ya ejecutaste el SQL manual compartido, corre primero `supabase/hotfix_revoke_unsafe_anon_policies.sql` en SQL Editor. Sus políticas permitían leer tenants/dispositivos completos e insertar dispositivos anónimamente.
4. `202610290002_console_operator_auth.sql` alinea `platform_operators` (la tabla creada por ese SQL), restringe las tablas administrativas a operadores autenticados y añade las RPC móviles acotadas.
5. Si existe una fila en `platform_operators`, `/setup` no crea otra cuenta. Usa la cuenta existente solo después de verificar Auth y cambiar la contraseña filtrada. Para cuentas nuevas, configura `SUPABASE_SERVICE_ROLE_KEY`, `CONSOLE_OWNER_EMAIL` y `CONSOLE_BOOTSTRAP_SECRET` únicamente si aún no hay propietario.
6. Nunca uses prefijo `NEXT_PUBLIC_` para secretos. El ingreso regular está en `/login`; el propietario administra las cuentas adicionales en `/operators`.
7. La app móvil requiere un development build para incluir `react-native-tcp-socket`; Expo Go no incluye ese módulo. El servidor local TCP no cifra el tráfico y en iOS puede suspenderse al enviar la app a segundo plano.
