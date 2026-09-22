import json

SUB = "3f1c2b9a-0000-4000-8000-000000000001"


def authorized_event(
    origin="https://smirnoff.xomware.com",
    path="/users/me",
    method="GET",
    body=None,
    email="Player@Example.com",
    sub=SUB,
):
    """A request as API Gateway delivers it once the Cognito authorizer passes an ID token."""
    return {
        "resource": path,
        "path": path,
        "httpMethod": method,
        "headers": {"Authorization": "eyJraWQiOiJleGFtcGxlIn0", "origin": origin},
        "queryStringParameters": None,
        "body": None if body is None else json.dumps(body),
        "isBase64Encoded": False,
        "requestContext": {
            "resourcePath": path,
            "httpMethod": method,
            "stage": "dev",
            "authorizer": {
                "claims": {
                    "sub": sub,
                    "email": email,
                    "email_verified": "true",
                    "cognito:username": "google_1234567890",
                    "token_use": "id",
                    "iss": "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_EXAMPLE",
                    "aud": "exampleclientid",
                }
            },
        },
    }
