-- Development-only fictional data. No real businesses or endorsements.
-- These remain pending and their jobs remain drafts. Do not create fake verified companies.
insert into public.businesses(id,name,description,category,address)
values ('20000000-0000-4000-8000-000000000001','Sample: Candelaria Community Co.','A fictional local business for development and portfolio demonstration only. This is not an active employer.','Local services','Sample address, Candelaria, Quezon')
on conflict(id) do nothing;
insert into public.jobs(business_id,title,description,employment_type,arrangement,location,category,salary_min,salary_max,deadline)
select id,'Sample: Administrative Assistant','Fictional draft role for testing. Assist a local team with scheduling, record keeping, and customer inquiries. This is not an active vacancy.','Full-time','On-site','Candelaria, Quezon','Administration',15000,18000,current_date+30
from public.businesses b where b.id='20000000-0000-4000-8000-000000000001' and not exists(select 1 from public.jobs j where j.business_id=b.id);
