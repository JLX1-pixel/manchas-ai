import io
import unittest
from contextlib import redirect_stderr
from unittest.mock import patch

from pydantic import ValidationError
from sqlalchemy.exc import OperationalError

from app.render_start import prepare, report_error
from app.schemas.auth import BusinessRegister


class RenderStartupTests(unittest.TestCase):
    def message(self, error):
        output = io.StringIO()
        with redirect_stderr(output):
            report_error(error)
        return output.getvalue()

    def test_missing_environment_lists_only_variable_names(self):
        with patch.dict("os.environ", {}, clear=True):
            with self.assertRaises(RuntimeError) as failure:
                prepare()
        output = self.message(failure.exception)
        self.assertIn("DATABASE_URL", output)
        self.assertIn("MANCHAS_OWNER_EMAIL", output)
        self.assertIn("Faltan variables", output)

    def test_invalid_email_and_password_omit_their_values(self):
        with self.assertRaises(ValidationError) as failure:
            BusinessRegister(
                business_name="Prueba",
                business_slug="prueba",
                business_email="correo-privado-invalido",
                admin_name="Administración",
                admin_email="correo-privado-invalido",
                admin_password="secreta",
            )
        output = self.message(failure.exception)
        self.assertIn("MANCHAS_OWNER_EMAIL", output)
        self.assertIn("MANCHAS_OWNER_PASSWORD", output)
        self.assertNotIn("correo-privado-invalido", output)
        self.assertNotIn("secreta", output)

    def test_database_and_unexpected_errors_omit_connection_and_parameters(self):
        private_url = "postgresql://usuario:clave-privada@host/database"
        output = self.message(OperationalError("SELECT clave-privada", {}, Exception(private_url)))
        self.assertIn("PostgreSQL", output)
        self.assertIn("OperationalError", output)
        self.assertNotIn("clave-privada", output)
        self.assertNotIn("postgresql://", output)
        self.assertNotIn("clave-privada", self.message(RuntimeError(private_url)))
