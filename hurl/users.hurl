# 1. Create a User (POST)
POST http://localhost:8080/users
{
    "email": "test@example.com"
}

HTTP 201
[Captures]
# Capture the generated ID from the JSON response
user_id: jsonpath "$.id"

# 2. Get the User (GET)
GET http://localhost:8080/users/{{user_id}}

HTTP 200
[Asserts]
jsonpath "$.username" == "tester_dev"
jsonpath "$.email" == "test@example.com"

# 3. Update the User (PUT)
PUT http://localhost:8080/users/{{user_id}}
{
    "username": "tester_updated",
    "email": "test@example.com"
}

HTTP 200
[Asserts]
jsonpath "$.username" == "tester_updated"

# 4. List All Users (GET)
GET http://localhost:8080/users

HTTP 200
[Asserts]
# Assert that our user exists in the list
jsonpath "$" count > 0

# 5. Delete the User (DELETE)
DELETE http://localhost:8080/users/{{user_id}}

HTTP 204
