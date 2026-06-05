# Tetris + Supabase Beginner Guide

## 1. What changed

The game now works in this order:

1. Paste your Supabase `Project URL`
2. Paste your `Publishable key`
3. Save the setup
4. Sign up or log in
5. Start the game
6. Save the best score to Supabase

## 2. What is stored now

This project now uses Supabase for login and score storage.

- Login: Supabase Auth
- Profile data: `profiles` table
- Best score: `best_score` column

## 3. Table structure

The game is built around this table shape:

- `id`
- `login_id`
- `login_email`
- `nickname`
- `best_score`

Important:

- `id` is the Supabase Auth user id
- `login_id` is the short ID typed in the game, such as `ryan`
- `login_email` is the generated Supabase Auth email, such as `ryan@tetris.co.kr`
- `nickname` is the name shown in the game
- `best_score` is the highest score

## 4. Password handling

The password is not stored in your `profiles` table.

That is intentional.

- Supabase Auth handles password login
- The table only keeps profile data
- This is safer than storing raw passwords yourself

## 5. What you need from Supabase

From the Supabase Overview screen, copy:

- `Project URL`
- `Publishable key`

Do not use:

- `Secret key`
- `Direct connection string`

## 6. SQL file to run

This project now includes:

- [supabase_profiles.sql](C:/Project/TETRIS/supabase_profiles.sql)

That SQL file creates or updates:

- `profiles` table
- `get_login_profile` RPC function for ID lookup
- Row Level Security
- Policies so a logged-in user can only read and edit their own profile

## 7. What to do now

1. Open your game page
2. Paste `Project URL` and `Publishable key` into `Supabase Setup`
3. Click `Save Supabase Info`
4. In Supabase, open `SQL Editor`
5. Run the SQL from [supabase_profiles.sql](C:/Project/TETRIS/supabase_profiles.sql)
6. Back in the game, click `Switch To Sign Up`
7. Enter ID and password
8. Create your account
9. Log in and start the game

## 8. If sign up does not log in right away

Supabase may require email confirmation by default.

That means:

- your account can be created
- but login may not work until email verification is complete

For simple testing, you can either:

- verify the email that Supabase sends
- or turn off email confirmation in Supabase Auth settings

## 9. The current login rule

The game now uses:

- `ID + password` in the UI
- generated `ID@tetris.co.kr` email inside Supabase Auth
- `nickname` for the display name

This is simpler and safer than trying to build your own password table first.

For example:

- if the user types `ryan`
- the app logs in through Supabase Auth as `ryan@tetris.co.kr`

## 10. If you see `Could not find the function`

If login shows this message:

`Could not find the function public.get_login_profile(target_login_id) in the schema cache`

Run [supabase_profiles.sql](C:/Project/TETRIS/supabase_profiles.sql) again in Supabase SQL Editor.

The SQL file is safe to rerun. It also asks Supabase to reload the PostgREST schema cache at the end.

After running it, refresh the game page and try login again.

## 11. Good next requests

- `Show me where to paste this in SQL Editor`
- `Help me run supabase_profiles.sql`
- `Check why sign up fails`
- `Check whether best score is saving`
