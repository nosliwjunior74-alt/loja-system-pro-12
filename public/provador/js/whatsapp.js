
window.WhatsAppModule={
  open(phone=''){
    const txt=encodeURIComponent('Foto do look pronta. Abra o WhatsApp Web e anexe a imagem salva.');
    let url=`https://wa.me/?text=${txt}`;
    if(phone){const clean=String(phone).replace(/\D/g,''); if(clean) url=`https://wa.me/55${clean}?text=${txt}`;}
    window.open(url,'_blank');
  },
  saveAndOpen(phone=''){CameraModule.savePhoto(); setTimeout(()=>this.open(phone),700);}
};
