import pytest

from lambdas.common.admins import is_admin
from tests.conftest import set_admins


def test_placeholder_list_admits_nobody(aws):
    assert is_admin("player@example.com") is False


@pytest.mark.parametrize("email", ["commish@example.com", "COMMISH@Example.com", " commish@example.com "])
def test_listed_email_is_admin_in_any_case(aws, email):
    set_admins(aws, "boss@example.com, Commish@example.com")
    assert is_admin(email) is True


def test_unlisted_email_is_not_admin(aws):
    set_admins(aws, "boss@example.com,commish@example.com")
    assert is_admin("player@example.com") is False
    assert is_admin("commish@example.co") is False


def test_list_edits_apply_without_a_redeploy(aws):
    assert is_admin("boss@example.com") is False
    set_admins(aws, "boss@example.com")
    assert is_admin("boss@example.com") is True
