# TASK 2 — Upsert current user on first request
#   Add POST /users/me. Extract the Cognito `sub` claim from the Authorization Bearer
#   token (decode without verification — API Gateway already validated it). Upsert a row
#   in `users` using the sub as `id` and the `email` claim as email. Return the user.

# 1. Create a User (POST)
POST http://localhost:8000/api/v1/users
{
    "email": "test@example.com"
}

# 2. Get the User (GET)
GET http://localhost:8000/users/{{user_id}}

HTTP 200
[Asserts]
jsonpath "$.username" == "tester_dev"
jsonpath "$.email" == "test@example.com"

# 3. Update the User (PUT)
PUT http://localhost:8000/users/{{user_id}}
{
    "username": "tester_updated",
    "email": "test@example.com"
}

HTTP 200
[Asserts]
jsonpath "$.username" == "tester_updated"

# 4. List All Users (GET)
GET http://localhost:8000/users

HTTP 200
[Asserts]
# Assert that our user exists in the list
jsonpath "$" count > 0

# 5. Delete the User (DELETE)
DELETE http://localhost:8000/users/{{user_id}}

HTTP 204

