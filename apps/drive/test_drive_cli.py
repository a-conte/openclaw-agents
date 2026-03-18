from __future__ import annotations

import unittest

import drive_cli


class DriveCliTests(unittest.TestCase):
    def test_extract_command_output_strips_tmux_prompt_and_sentinels(self) -> None:
        output = "\n".join(
            [
                "a_conte@server % printf '__START_abc'",
                "__START_abc",
                "line one",
                "line two",
                "__DONE_abc:0",
                "a_conte@server %",
            ]
        )
        cleaned = drive_cli.extract_command_output(output, "__START_abc", "__DONE_abc")
        self.assertEqual(cleaned, "line one\nline two")


if __name__ == "__main__":
    unittest.main()
