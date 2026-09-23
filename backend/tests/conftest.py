import boto3
import pytest
from moto import mock_aws

USERS_TABLE = "t-smirnoff-users"
ICES_TABLE = "t-smirnoff-ices"
SETTINGS_TABLE = "t-smirnoff-settings"
MEDIA_TABLE = "t-smirnoff-media"
MEDIA_BUCKET = "t-smirnoff-media"
ADMIN_EMAILS_PARAM = "/smirnoff/admin-emails"


@pytest.fixture
def aws(monkeypatch):
    """A moto account with the tables, the media bucket and the admin list at Terraform's placeholder."""
    for k, v in {
        "AWS_REGION": "us-east-1",
        "AWS_DEFAULT_REGION": "us-east-1",
        "AWS_ACCESS_KEY_ID": "testing",
        "AWS_SECRET_ACCESS_KEY": "testing",
        "USERS_TABLE": USERS_TABLE,
        "ICES_TABLE": ICES_TABLE,
        "SETTINGS_TABLE": SETTINGS_TABLE,
        "MEDIA_TABLE": MEDIA_TABLE,
        "MEDIA_BUCKET": MEDIA_BUCKET,
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
        for name, pk, sk in (
            (ICES_TABLE, "season", "iceId"),
            (SETTINGS_TABLE, "season", "key"),
            (MEDIA_TABLE, "kind", "mediaId"),
        ):
            boto3.client("dynamodb").create_table(
                TableName=name,
                KeySchema=[
                    {"AttributeName": pk, "KeyType": "HASH"},
                    {"AttributeName": sk, "KeyType": "RANGE"},
                ],
                AttributeDefinitions=[
                    {"AttributeName": pk, "AttributeType": "S"},
                    {"AttributeName": sk, "AttributeType": "S"},
                ],
                BillingMode="PAY_PER_REQUEST",
            )
        boto3.client("s3").create_bucket(Bucket=MEDIA_BUCKET)
        ssm = boto3.client("ssm")
        ssm.put_parameter(Name=ADMIN_EMAILS_PARAM, Type="StringList", Value="unset")
        yield ssm


def set_admins(ssm, value: str) -> None:
    ssm.put_parameter(Name=ADMIN_EMAILS_PARAM, Type="StringList", Value=value, Overwrite=True)
