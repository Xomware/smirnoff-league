def authorized_event(origin="https://smirnoff.xomware.com"):
    """GET /users/me as API Gateway delivers it once the Cognito authorizer passes an ID token."""
    return {
        "resource": "/users/me",
        "path": "/users/me",
        "httpMethod": "GET",
        "headers": {"Authorization": "eyJraWQiOiJleGFtcGxlIn0", "origin": origin},
        "queryStringParameters": None,
        "body": None,
        "isBase64Encoded": False,
        "requestContext": {
            "resourcePath": "/users/me",
            "httpMethod": "GET",
            "stage": "dev",
            "authorizer": {
                "claims": {
                    "sub": "3f1c2b9a-0000-4000-8000-000000000001",
                    "email": "Player@Example.com",
                    "email_verified": "true",
                    "cognito:username": "google_1234567890",
                    "token_use": "id",
                    "iss": "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_EXAMPLE",
                    "aud": "exampleclientid",
                }
            },
        },
    }
