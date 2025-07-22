import React from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";

interface ButtonProps {
  titulo: string;
  onPress?: () => void;
}

const Button: React.FC<ButtonProps> = ({ titulo, onPress }) => {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress}>
      <Text style={styles.buttonText}>{titulo}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: "100%",
    height: 50,
    borderRadius: 20,
    backgroundColor: "#021C4E",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 32,
  },
  buttonText: {
    color: "#ffffff",
    fontFamily: "Alumni Sans SC",
    fontSize: 16,
    fontWeight: "700",
  },
});

export default Button;