# Personal contacts for quiz sharing

The Share a quiz dialog will include a searchable personal contact list, while keeping direct email entry available.

- Each professor can add a contact with a name and email, edit it, or remove it.
- Sending a sharing request remembers that recipient for next time without duplicating their email. An optional name can be added later.
- Selecting a contact fills the recipient email; sending still requires clicking Send sharing request.
- Contacts persist across devices and are visible only to their owner. Account deletion removes that owner's contacts.
- This is an address book, not an account directory. Adding an email does not reveal whether it is registered. Existing sharing rules and generic receipts remain unchanged; recipients must have an eligible Examio account to receive a quiz.
- Search matches names and emails. Empty, loading and failure states remain usable, with direct email entry available if contacts cannot load.
- Keep Examio's current styling, mobile layout and English/Korean interface support.

Verify owner isolation, normalized email deduplication, input validation, deletion cleanup, contact selection, editing, removal, remembered recipients and unchanged sharing behavior before release.
