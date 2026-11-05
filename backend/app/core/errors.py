class NotFoundError(Exception):
    """Raised by services when a requested record doesn't exist."""

    def __init__(self, resource: str, resource_id: int):
        super().__init__(f"{resource} {resource_id} not found")
        self.resource = resource
        self.resource_id = resource_id
