"""
Custom exception hierarchy for Medianest backend.

All custom exceptions should inherit from AppException.
This enables centralized error handling and consistent error reporting/logging.
"""

class AppException(Exception):
    """
    Base exception for all application-specific errors.

    Args:
        message (str): Human-readable error message.
        code (int, optional): Optional error code for categorization.
    """
    def __init__(self, message: str, code: int = None):
        super().__init__(message)
        self.message = message
        self.code = code

    def __str__(self):
        return f"{self.__class__.__name__}: {self.message}" + (f" [code={self.code}]" if self.code is not None else "")


class ValidationError(AppException):
    """
    Exception raised for validation errors (e.g., invalid input data).

    Args:
        message (str): Description of the validation error.
        code (int, optional): Optional error code.
    """
    pass


class DatabaseError(AppException):
    """
    Exception raised for database-related errors.

    Args:
        message (str): Description of the database error.
        code (int, optional): Optional error code.
    """
    pass


class ExternalServiceError(AppException):
    """
    Exception raised when an external service call fails.

    Args:
        message (str): Description of the external service error.
        code (int, optional): Optional error code.
    """
    pass

# Add additional custom exceptions as needed, inheriting from AppException.