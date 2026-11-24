-- FORMA CRM: register the existing Supabase Auth user as an administrator.
insert into public.crm_admins (user_id)
select id
from auth.users
where lower(email) = lower('zirael7@gmail.com')
on conflict (user_id) do nothing;

-- Verify that the administrator entry exists.
select u.email, a.user_id
from public.crm_admins as a
join auth.users as u on u.id = a.user_id
where lower(u.email) = lower('zirael7@gmail.com');
