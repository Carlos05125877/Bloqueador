import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface SelectFuncaoProps {
  title: string;
  icon: React.ReactNode;
  onPress?: () => void;
}

const SelectFuncao: React.FC<SelectFuncaoProps> = ({ title, icon, onPress }) => (
  <TouchableOpacity onPress={onPress} style={styles.button}>
    <View style={styles.iconContainer}>{icon}</View>
    <Text style={styles.title}>{title}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  button: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: '#002845',
    shadowColor: '#002845',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    marginBottom: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#002845',
    width: 160,
    textAlign: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default SelectFuncao;