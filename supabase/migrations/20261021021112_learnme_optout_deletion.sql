begin;
-- DELETE needs SELECT visibility. Hiding rows after opt-out prevented the
-- invoker cleanup trigger from deleting them. Ownership still isolates users;
-- insertion remains gated by opt-in and serialized against preference updates.
alter policy own_read on public.learnme_examples using (sender_id=(select auth.uid()));
delete from public.learnme_examples e where not exists (
  select 1 from public.learnme_preferences p where p.sender_id=e.sender_id and p.enabled
);
commit;
