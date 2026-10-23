-- Short job descriptions are allowed; a nonblank description remains required.
-- Keep the existing NOT NULL column and the 15,000-character maximum.
alter table public.jobs drop constraint jobs_description_check;
alter table public.jobs add constraint jobs_description_check
  check (length(description) <= 15000 and description ~ '[^[:space:]]');
