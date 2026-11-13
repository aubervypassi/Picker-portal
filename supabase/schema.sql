-- =====================================================================
-- Picker Portal — schéma Supabase attendu par src/lib/supabase.ts
-- À exécuter dans Supabase > SQL Editor. Script NON destructif :
-- il crée les tables absentes, ajoute les colonnes manquantes,
-- convertit les colonnes `id` en texte si besoin, et ouvre les accès.
-- =====================================================================

create table if not exists pickers (id text primary key);
alter table pickers add column if not exists nom text;
alter table pickers add column if not exists store text;          -- 'ABN' | 'ABJ' | 'ALL'
alter table pickers add column if not exists fonction text;
alter table pickers add column if not exists equipe text;
alter table pickers add column if not exists lead_id text;
alter table pickers add column if not exists pin text;
alter table pickers add column if not exists niveau int default 1;
alter table pickers add column if not exists statut text default 'Actif';

create table if not exists pointages (id text primary key);
alter table pointages add column if not exists picker_id text;
alter table pointages add column if not exists store text;
alter table pointages add column if not exists type text;         -- 'ENTRÉE' | 'SORTIE'
alter table pointages add column if not exists horodatage timestamptz default now();
alter table pointages add column if not exists latitude double precision;
alter table pointages add column if not exists longitude double precision;
alter table pointages add column if not exists distance_m int;
alter table pointages add column if not exists precision_m int;
alter table pointages add column if not exists photo_url text;
alter table pointages add column if not exists simule boolean default false;

create table if not exists plannings (id text primary key);
alter table plannings add column if not exists store text;
alter table plannings add column if not exists date date;
alter table plannings add column if not exists picker_id text;
alter table plannings add column if not exists shift text;        -- M S N H I R C A
alter table plannings add column if not exists statut text;       -- 'brouillon' | 'publie' | 'nuit'

create table if not exists demandes_explication (id text primary key);
alter table demandes_explication add column if not exists picker_id text;
alter table demandes_explication add column if not exists motif text;
alter table demandes_explication add column if not exists details text;
alter table demandes_explication add column if not exists cree_le timestamptz default now();
alter table demandes_explication add column if not exists echeance timestamptz;
alter table demandes_explication add column if not exists reponse text;
alter table demandes_explication add column if not exists repondu_le timestamptz;
alter table demandes_explication add column if not exists statut text;
alter table demandes_explication add column if not exists decision text;
alter table demandes_explication add column if not exists commentaire_admin text;
alter table demandes_explication add column if not exists traite_le timestamptz;

create table if not exists requetes (id text primary key);
alter table requetes add column if not exists picker_id text;
alter table requetes add column if not exists type text;          -- permission | absence | commentaire
alter table requetes add column if not exists date_debut date;
alter table requetes add column if not exists date_fin date;
alter table requetes add column if not exists message text;
alter table requetes add column if not exists cree_le timestamptz default now();
alter table requetes add column if not exists statut text;
alter table requetes add column if not exists note_admin text;
alter table requetes add column if not exists maj_le timestamptz;

create table if not exists rapports_shift (id text primary key);
alter table rapports_shift add column if not exists store text;
alter table rapports_shift add column if not exists auteur_id text;
alter table rapports_shift add column if not exists date date;
alter table rapports_shift add column if not exists shift text;
alter table rapports_shift add column if not exists reponses jsonb;
alter table rapports_shift add column if not exists cree_le timestamptz default now();

create table if not exists parametres (cle text primary key);
alter table parametres add column if not exists valeur jsonb;

-- Les identifiants générés par l'application sont du texte (ex. "p8k2…", "105607").
-- Si une table a été créée avec un id uuid / bigint, on le convertit en texte.
do $$
declare t text;
begin
  foreach t in array array['pickers','pointages','plannings','demandes_explication','requetes','rapports_shift'] loop
    if (select data_type from information_schema.columns where table_schema='public' and table_name=t and column_name='id') <> 'text' then
      execute format('alter table %I alter column id drop default', t);
      begin execute format('alter table %I alter column id drop identity if exists', t); exception when others then null; end;
      execute format('alter table %I alter column id type text using id::text', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Connexion : vérification du PIN côté serveur. Les appareils ne peuvent
-- pas lire la colonne `pin` (seulement l'écrire).
-- ---------------------------------------------------------------------
create or replace function verifier_pin(p_id text, p_pin text)
returns boolean language sql security definer set search_path = public as $$
  select exists(select 1 from pickers where id = p_id and pin = p_pin and coalesce(statut,'Actif') = 'Actif');
$$;
grant execute on function verifier_pin(text, text) to anon, authenticated;

revoke select on pickers from anon, authenticated;
grant select (id, nom, store, fonction, equipe, lead_id, niveau, statut) on pickers to anon, authenticated;
grant insert, update, delete on pickers to anon, authenticated;

-- ---------------------------------------------------------------------
-- RLS : l'application utilise la clé publique (pas de Supabase Auth),
-- l'accès est donc ouvert à la clé « anon ».
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['pickers','pointages','plannings','demandes_explication','requetes','rapports_shift','parametres'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "picker_portal_anon" on %I', t);
    execute format('create policy "picker_portal_anon" on %I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Photos de pointage : envoi autorisé dans le bucket public
drop policy if exists "picker_portal_photos_upload" on storage.objects;
create policy "picker_portal_photos_upload" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'pointages-photos');
drop policy if exists "picker_portal_photos_read" on storage.objects;
create policy "picker_portal_photos_read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'pointages-photos');

-- Temps réel (mise à jour instantanée entre téléphones)
do $$
declare t text;
begin
  foreach t in array array['pickers','pointages','plannings','demandes_explication','requetes','rapports_shift','parametres'] loop
    begin execute format('alter publication supabase_realtime add table %I', t);
    exception when others then null; end;
  end loop;
end $$;
