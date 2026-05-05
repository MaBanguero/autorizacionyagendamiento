import os
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

from domain.interfaces import IPDFService
from domain.models import OrdenMedica


class PDFGeneratorService(IPDFService):
    def __init__(self, output_dir: str = "pdfs_autorizaciones"):
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)

    def generar_pdf_firmado(self, orden: OrdenMedica) -> str:
        filename = f"autorizacion_{orden.numero_orden}_{datetime.now().strftime('%Y%m%d%H%M%S')}.pdf"
        filepath = os.path.join(self.output_dir, filename)

        c = canvas.Canvas(filepath, pagesize=letter)
        width, height = letter

        y = height - 60

        c.setFont("Helvetica-Bold", 16)
        c.drawString(60, y, "Autorización Médica")
        y -= 40

        c.setFont("Helvetica", 11)
        c.drawString(60, y, f"Número de orden: {orden.numero_orden}")
        y -= 22
        c.drawString(60, y, f"Paciente: {orden.paciente.nombre}")
        y -= 22
        c.drawString(60, y, f"Documento: {orden.paciente.tipo_documento}")
        y -= 22
        c.drawString(60, y, f"Teléfono: {orden.paciente.telefono}")
        y -= 22
        c.drawString(60, y, f"Convenio: {orden.paciente.convenio}")
        y -= 22
        c.drawString(60, y, f"Régimen: {orden.paciente.regimen}")
        y -= 22
        c.drawString(60, y, f"Estudio: {orden.estudio}")
        y -= 22
        c.drawString(60, y, f"Estado: {orden.estado}")
        y -= 22
        c.drawString(60, y, f"Autorizado por: {orden.autorizado_por or 'N/A'}")
        y -= 22
        c.drawString(60, y, f"Fecha autorización: {orden.fecha_autorizacion or 'N/A'}")
        y -= 22
        c.drawString(60, y, f"Fecha cita: {orden.fecha_cita or 'N/A'}")

        y -= 60
        c.line(60, y, 260, y)
        y -= 18
        c.drawString(60, y, "Firma autorizada")

        c.save()

        return filepath