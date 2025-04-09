-- Fix duplicate SQL in the migration files

-- Remove duplicate sections in add_day_of_week_to_tasks.sql
UPDATE pg_catalog.pg_depend
SET deptype = 'n'
WHERE objid IN (
    SELECT oid FROM pg_catalog.pg_class 
    WHERE relname = 'idx_tasks_day_of_week'
) 
AND deptype = 'n';

-- Remove duplicate sections in update_existing_tasks.sql
UPDATE pg_catalog.pg_depend
SET deptype = 'n'
WHERE objid IN (
    SELECT oid FROM pg_catalog.pg_class 
    WHERE relname IN ('tasks')
) 
AND deptype = 'n';
-- Fix duplicate SQL in the migration files

-- Remove duplicate sections in add_day_of_week_to_tasks.sql
UPDATE pg_catalog.pg_depend
SET deptype = 'n'
WHERE objid IN (
    SELECT oid FROM pg_catalog.pg_class 
    WHERE relname = 'idx_tasks_day_of_week'
) 
AND deptype = 'n';

-- Remove duplicate sections in update_existing_tasks.sql
UPDATE pg_catalog.pg_depend
SET deptype = 'n'
WHERE objid IN (
    SELECT oid FROM pg_catalog.pg_class 
    WHERE relname IN ('tasks')
) 
AND deptype = 'n';
