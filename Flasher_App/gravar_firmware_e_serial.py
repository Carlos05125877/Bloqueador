import sys
import os
import subprocess
import serial.tools.list_ports
from PyQt6.QtWidgets import (QApplication, QWidget, QVBoxLayout, QFormLayout, 
                             QLineEdit, QPushButton, QLabel, QMessageBox, 
                             QFileDialog, QHBoxLayout, QComboBox)

# Tenta encontrar o caminho para o esptool.py
def find_esptool():
    if os.name == 'nt':
        esptool_name = 'esptool.exe'
    else:
        esptool_name = 'esptool.py'

    for path in os.environ["PATH"].split(os.pathsep):
        full_path = os.path.join(path, esptool_name)
        if os.path.isfile(full_path):
            return full_path
    
    return "python -m esptool"

esptool_path = find_esptool()

class FlasherApp(QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Ferramenta de Gravação de Firmware e Serial")
        self.setFixedSize(500, 250)

        self.layout = QVBoxLayout()
        self.form_layout = QFormLayout()

        # Campo para o arquivo de firmware
        self.firmware_path_input = QLineEdit()
        self.firmware_path_input.setReadOnly(True)
        self.firmware_button = QPushButton("Selecionar Firmware (.bin)")
        self.firmware_button.clicked.connect(self.select_firmware_file)

        firmware_layout = QHBoxLayout()
        firmware_layout.addWidget(self.firmware_path_input)
        firmware_layout.addWidget(self.firmware_button)
        self.form_layout.addRow("Arquivo do Firmware:", firmware_layout)

        # Campo para a Porta Serial (agora um QComboBox)
        self.port_combo = QComboBox()
        self.port_combo.setPlaceholderText("Detectando portas...")
        self.form_layout.addRow("Porta Serial:", self.port_combo)
        
        # Botão para atualizar a lista de portas
        self.refresh_button = QPushButton("Atualizar")
        self.refresh_button.clicked.connect(self.update_serial_ports)
        self.form_layout.addWidget(self.refresh_button)

        # Campo para o Número de Série
        self.serial_input = QLineEdit()
        self.serial_input.setPlaceholderText("Ex: ContourlineRastreador0001")
        self.form_layout.addRow("Número de Série:", self.serial_input)

        # Botão de Gravação
        self.flash_button = QPushButton("Gravar Firmware e Número de Série")
        self.flash_button.clicked.connect(self.start_flash)

        self.status_label = QLabel("Pronto para gravar.")
        self.status_label.setStyleSheet("font-weight: bold;")

        self.layout.addLayout(self.form_layout)
        self.layout.addWidget(self.flash_button)
        self.layout.addWidget(self.status_label)
        self.setLayout(self.layout)
        
        self.update_serial_ports()

    def update_serial_ports(self):
        self.port_combo.clear()
        ports = serial.tools.list_ports.comports()
        
        if not ports:
            self.port_combo.addItem("Nenhuma porta serial encontrada")
            self.flash_button.setEnabled(False)
            return

        self.port_combo.addItem("--- Selecionar Porta ---")
        
        esp_ports = []
        for port in ports:
            if "CP210" in port.description or "CH340" in port.description or "USB Serial" in port.description:
                esp_ports.append(port.device)
            self.port_combo.addItem(port.device)
        
        if len(esp_ports) == 1:
            index = self.port_combo.findText(esp_ports[0])
            if index != -1:
                self.port_combo.setCurrentIndex(index)
        
        self.flash_button.setEnabled(True)

    def select_firmware_file(self):
        filename, _ = QFileDialog.getOpenFileName(self, "Selecionar Arquivo de Firmware", "", "Binário (*.bin)")
        if filename:
            self.firmware_path_input.setText(filename)

    def start_flash(self):
        port = self.port_combo.currentText()
        serial_number = self.serial_input.text().strip()
        firmware_path = self.firmware_path_input.text().strip()

        if port == "--- Selecionar Porta ---" or not port or not serial_number or not firmware_path:
            QMessageBox.warning(self, "Campos Vazios", "Por favor, preencha todos os campos e selecione uma porta serial válida.")
            return

        # Desativa os botões para evitar interrupções
        self.flash_button.setEnabled(False)
        self.refresh_button.setEnabled(False)
        self.status_label.setText("Iniciando gravação... Não desconecte o dispositivo.")
        QApplication.processEvents()

        # Primeiro, grava o firmware
        self.status_label.setText("1/2: Gravando firmware... Isso pode levar alguns segundos.")
        QApplication.processEvents()
        success, message = self.gravar_firmware(port, firmware_path)
        if not success:
            QMessageBox.critical(self, "Erro na Gravação do Firmware", message)
            self.status_label.setText("Falha na gravação do firmware. Verifique as conexões.")
            self.flash_button.setEnabled(True)
            self.refresh_button.setEnabled(True)
            return

        # Depois, grava o número de série
        self.status_label.setText("2/2: Firmware gravado. Gravando número de série...")
        QApplication.processEvents()
        success, message = self.gravar_serial_esp32(port, serial_number)
        
        self.flash_button.setEnabled(True)
        self.refresh_button.setEnabled(True)
        self.status_label.setText(message)

        if success:
            final_message = "Gravação concluída com sucesso! Firmware e número de série gravados."
            QMessageBox.information(self, "Sucesso", final_message)
            self.status_label.setText(final_message)
        else:
            final_message = f"Falha na gravação do número de série:\n{message}"
            QMessageBox.critical(self, "Erro na Gravação do Serial", final_message)
            self.status_label.setText(final_message)

    def gravar_firmware(self, port, firmware_path):
        try:
            command = [
                esptool_path,
                "--chip", "esp32",
                "--port", port,
                "--baud", "921600",
                "write_flash",
                "0x10000", firmware_path
            ]
            
            result = subprocess.run(command, check=True, capture_output=True, text=True)
            return True, "Firmware gravado com sucesso."
        except subprocess.CalledProcessError as e:
            return False, f"Erro ao gravar o firmware:\n{e.stderr}"

    def gravar_serial_esp32(self, port, serial_number):
        try:
            # Cria um arquivo temporário com o número de série
            # Formato simples que pode ser lido pelo ESP32
            serial_data = f"SERIAL:{serial_number}\n"
            temp_file = "serial_temp.txt"
            
            with open(temp_file, 'w') as f:
                f.write(serial_data)
            
            # Usa esptool para gravar o arquivo na memória flash
            command = [
                esptool_path,
                "--chip", "esp32",
                "--port", port,
                "--baud", "921600",
                "write_flash",
                "0x9000", temp_file
            ]
            
            result = subprocess.run(command, check=True, capture_output=True, text=True)
            os.remove(temp_file)
            
            return True, "Número de série gravado com sucesso."
        except subprocess.CalledProcessError as e:
            return False, f"Erro ao gravar o número de série:\n{e.stderr}"
        except Exception as e:
            return False, f"Erro inesperado: {e}"

if __name__ == '__main__':
    app = QApplication(sys.argv)
    ex = FlasherApp()
    ex.show()
    sys.exit(app.exec())
    