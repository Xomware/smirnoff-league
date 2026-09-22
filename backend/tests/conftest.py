import boto3
import pytest
from moto import mock_aws

USERS_TABLE = "t-smirnoff-users"
ADMIN_EMAILS_PARAM = "/smirnoff/admin-emails"


@pytest.fixture
def aws(monkeypatch):
    """A moto account with the users table and the admin list at Terraform's placeholder."""
    for k, v in {
        "AWS_REGION": "us-east-1",
        "AWS_DEFAULT_REGION": "us-east-1",
        "AWS_ACCESS_KEY_ID": "testing",
        "AWS_SECRET_ACCESS_KEY": "testing",
        "USERS_TABLE": USERS_TABLE,
        "ADMIN_EMAILS_PARAM": ADMIN_EMAILS_PARAM,
    }.items():
        monkeypatch.setenv(k, v)
    with mock_aws():
        boto3.client("dynamodb").create_table(
            TableName=USERS_TABLE,
            KeySchema=[{"AttributeName": "sub", "KeyType": "HASH"}],
            AttributeDefinitions=[{"AttributeName": "sub", "AttributeType": "S"}],
            BillingMode="PAY_PER_REQUEST",
        )
        ssm = boto3.client("ssm")
        ssm.put_parameter(Name=ADMIN_EMAILS_PARAM, Type="StringList", Value="unset")
        yield ssm


def set_admins(ssm, value: str) -> None:
    ssm.put_parameter(Name=ADMIN_EMAILS_PARAM, Type="StringList", Value=value, Overwrite=True)
