import styled, { keyframes } from "styled-components";

const slideIn = keyframes`
  from { transform: translateY(-100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
`;

const ToastContainer = styled.div<{ type: "error" | "success" | "info" }>`
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 12px 24px;
  background-color: ${({ type }) => {
    switch (type) {
      case "error":
        return "#f44336";
      case "success":
        return "#4caf50";
      default:
        return "#2196f3";
    }
  }};
  color: white;
  border-radius: 4px;
  animation: ${slideIn} 0.3s ease-out;
  z-index: 1000;
`;

export const Toast = ({
  message,
  type,
}: {
  message: string;
  type: "error" | "success" | "info";
}) => <ToastContainer type={type}>{message}</ToastContainer>;
