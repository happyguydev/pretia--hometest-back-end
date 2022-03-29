# JWT server

## DB Migrations

DB migrations:

1. Make changes to the DB either directly.
2. Run `yarn prisma db pull` to change schema.prisma and then `yarn prisma generate` to and update the Typescript library.
3. Rebuild the container with `docker-compose up -d --build jwt-api`.
4. Run `pg_dump -h localhost -p 4103 -U pretia pretia > initdb.d/init.sql` and check `initdb.d/init.sql` for accuracy.

The database can be wiped and seeded with `yarn prisma db reset` or
Running migrations from other developers can be done by pulling from git then running `docker-compose down && docker-compose up -d`.

## API

- /register -- adds user to database, syncs with external service
- /login -- sends a token if pw is correct
- /applist -- send the app list
- /create-edit-app -- create or update app details
- /delete-app -- delete apps with id list
- /refresh -- uses refresh token to get new access token

## CONFIGURATION ENVIRONMENT VARIABLES

JWT_SECRET - the secret used to sign tokens
ACCESS_TOKEN_MINUTES - number of minutes access tokens live for (default 4)
REFRESH_TOKEN_MINUTES - number of minutes refresh tokens live for (default 240 which is 4 hours)
