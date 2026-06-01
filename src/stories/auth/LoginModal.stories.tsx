import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import LoginModal from "@/components/auth/LoginModal";

function LoginModalOpen() {
  return <LoginModal open onClose={() => {}} />;
}

const meta: Meta<typeof LoginModalOpen> = {
  title: "Auth/LoginModal",
  component: LoginModalOpen,
};

export default meta;

export const Open: StoryObj<typeof LoginModalOpen> = {};
