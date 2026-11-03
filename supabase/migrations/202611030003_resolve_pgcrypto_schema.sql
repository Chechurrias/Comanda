do $$
declare
  v_crypto_schema text;
  v_test_hash text;
begin
  select n.nspname
    into v_crypto_schema
  from pg_catalog.pg_extension e
  join pg_catalog.pg_namespace n
    on n.oid = e.extnamespace
  where e.extname = 'pgcrypto';

  if v_crypto_schema is null then
    raise exception 'pgcrypto is not installed; enable the pgcrypto extension in Supabase before applying this migration.';
  end if;

  if pg_catalog.to_regprocedure(
    pg_catalog.format('%I.gen_salt(text,integer)', v_crypto_schema)
  ) is null
     or pg_catalog.to_regprocedure(
       pg_catalog.format('%I.crypt(text,text)', v_crypto_schema)
     ) is null then
    raise exception 'pgcrypto is installed in schema %, but gen_salt/crypt are missing there.', v_crypto_schema;
  end if;

  execute pg_catalog.format(
    'select %I.crypt($1, %I.gen_salt(''bf''::text))',
    v_crypto_schema,
    v_crypto_schema
  )
  into v_test_hash
  using 'test-pin';

  if v_test_hash is null or v_test_hash = '' then
    raise exception 'pgcrypto PIN hashing verification returned an empty hash.';
  end if;

  execute pg_catalog.format(
    'alter function public.admin_create_waiter(uuid, text, text) set search_path to %I, public, pg_temp',
    v_crypto_schema
  );
  execute pg_catalog.format(
    'alter function public.login_waiter(text, text, text) set search_path to %I, public, pg_temp',
    v_crypto_schema
  );
  execute pg_catalog.format(
    'alter function public.resolve_restaurant_actor(uuid, text) set search_path to %I, public, pg_temp',
    v_crypto_schema
  );

  if pg_catalog.to_regprocedure('public.admin_reset_waiter_pin(uuid,uuid,text)') is not null then
    execute pg_catalog.format(
      'alter function public.admin_reset_waiter_pin(uuid, uuid, text) set search_path to %I, public, pg_temp',
      v_crypto_schema
    );
  end if;
end;
$$;
