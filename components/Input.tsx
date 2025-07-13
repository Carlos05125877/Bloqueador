import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export interface InputProps {
  label: string;
  inputType: string;
  secureTextEntry: boolean;
  value: string;
  placeholder?: string;
  onChangeText: (text: string) => void;
}

function Input({
  label,
  inputType,
  secureTextEntry,
  value,
  onChangeText,
}: InputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={styles.inputBox}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor="#333"
        secureTextEntry={secureTextEntry && !showPassword}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={inputType === 'email' ? 'email-address' : 'default'}
      />
      {secureTextEntry && (
        <TouchableOpacity
          style={styles.showSenhaButton}
          onPress={() => setShowPassword((v) => !v)}
        >
          <Text style={styles.showSenhaText}>{showPassword ? 'Ocultar' : 'Exibir'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 266,
    height: 55,
    backgroundColor: '#eaeaea',
    borderRadius: 10,
    marginBottom: 0,
    paddingHorizontal: 0,
  },
  input: {
    flex: 1,
    height: 54,
    paddingHorizontal: 10,
    fontSize: 20,
    color: '#333',
    backgroundColor: 'transparent',
    borderRadius: 4,
  },
  showSenhaButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  showSenhaText: {
    color: '#002845',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default Input;