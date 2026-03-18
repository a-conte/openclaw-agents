from __future__ import annotations

import unittest

import drive_cli


class DriveCliTests(unittest.TestCase):
    def test_make_sentinel_avoids_zsh_status_variable(self) -> None:
        start_token, stdout_start, stdout_end, stderr_start, stderr_end, done_token, wrapped = drive_cli.make_sentinel("printf 'hello'")
        self.assertIn(start_token, wrapped)
        self.assertIn(stdout_start, wrapped)
        self.assertIn(stdout_end, wrapped)
        self.assertIn(stderr_start, wrapped)
        self.assertIn(stderr_end, wrapped)
        self.assertIn(done_token, wrapped)
        self.assertIn("drive_exit_code=$?", wrapped)
        self.assertNotIn("status=$?", wrapped)

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

    def test_extract_section_returns_captured_segment(self) -> None:
        output = "\n".join(
            [
                "__STDOUT_START_abc",
                "line one",
                "line two",
                "__STDOUT_END_abc",
            ]
        )
        cleaned = drive_cli.extract_section(output, "__STDOUT_START_abc", "__STDOUT_END_abc")
        self.assertEqual(cleaned, "line one\nline two")


if __name__ == "__main__":
    unittest.main()
