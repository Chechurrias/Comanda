import * as Crypto from 'expo-crypto';
import { useEffect, useState } from 'react';
import {
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { localDbService } from '../../core/database';

const CATEGORIES = ['Todas', 'Platos Fuertes', 'Entradas', 'Bebidas', 'Licores', 'Postres'];

export default function MenuScreen() {
  const [menu, setMenu] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', price: '', category: 'Platos Fuertes' });

  const loadMenu = () => {
    setMenu(localDbService.getMenu());
  };

  useEffect(() => {
    loadMenu();
  }, []);

  const handleSaveProduct = () => {
    if (!form.name.trim() || !form.price) {
      Alert.alert('Datos requeridos', 'Ingresa nombre y precio.');
      return;
    }

    const priceNum = parseInt(form.price.replace(/[^0-9]/g, ''));
    localDbService.addMenuItem({
      id: Crypto.randomUUID(),
      name: form.name.trim(),
      price: priceNum,
      category: form.category,
    });

    setForm({ name: '', price: '', category: 'Platos Fuertes' });
    setIsModalOpen(false);
    loadMenu();
  };

  const handleToggle = (id: string, current: number) => {
    localDbService.toggleMenuItem(id, current === 0);
    loadMenu();
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Eliminar Plato', `¿Deseas quitar "${name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => {
        localDbService.deleteMenuItem(id);
        loadMenu();
      }}
    ]);
  };

  const filtered = selectedCategory === 'Todas' ? menu : menu.filter(m => m.category === selectedCategory);

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.addBtn}
        onPress={() => setIsModalOpen(true)}
      >
        <Text style={styles.addBtnText}>+ Agregar Plato / Bebida</Text>
      </TouchableOpacity>

      {/* Categorías */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[styles.filterChip, selectedCategory === cat && styles.filterChipActive]}
            onPress={() => setSelectedCategory(cat)}
          >
            <Text style={[styles.filterText, selectedCategory === cat && styles.filterTextActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Lista */}
      <ScrollView contentContainerStyle={styles.list}>
        {filtered.length === 0 ? (
          <Text style={styles.emptyText}>No hay platos registrados en esta categoría.</Text>
        ) : (
          filtered.map(item => (
            <View key={item.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{item.name}</Text>
                <Text style={styles.itemSub}>{item.category} • <Text style={styles.priceTag}>${item.price.toLocaleString()} COP</Text></Text>
              </View>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.toggleBtn, item.is_available ? styles.toggleOn : styles.toggleOff]}
                  onPress={() => handleToggle(item.id, item.is_available)}
                >
                  <Text style={styles.toggleText}>{item.is_available ? 'Disponible' : 'Agotado'}</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.deleteBtn}
                  onPress={() => handleDelete(item.id, item.name)}
                >
                  <Text style={styles.deleteText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Modal */}
      <Modal visible={isModalOpen} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Nuevo Plato / Bebida</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Nombre (Ej: Bandeja Paisa)"
              placeholderTextColor="#64748b"
              value={form.name}
              onChangeText={t => setForm({ ...form, name: t })}
            />

            <TextInput
              style={styles.input}
              placeholder="Precio COP (Ej: 28000)"
              placeholderTextColor="#64748b"
              keyboardType="numeric"
              value={form.price}
              onChangeText={t => setForm({ ...form, price: t })}
            />

            <Text style={styles.inputLabel}>Categoría:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {CATEGORIES.filter(c => c !== 'Todas').map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.catChoice, form.category === c && styles.catChoiceActive]}
                  onPress={() => setForm({ ...form, category: c })}
                >
                  <Text style={[styles.catChoiceText, form.category === c && styles.catChoiceTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setIsModalOpen(false)}>
                <Text style={styles.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnConfirm} onPress={handleSaveProduct}>
                <Text style={styles.btnConfirmText}>Guardar Plato</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617', padding: 16 },
  addBtn: { backgroundColor: '#4f46e5', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  addBtnText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },
  filterBar: { flexDirection: 'row', maxHeight: 42, marginBottom: 14 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#0f172a', marginRight: 8, borderWidth: 1, borderColor: '#1e293b' },
  filterChipActive: { backgroundColor: '#4f46e5', borderColor: '#6366f1' },
  filterText: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  filterTextActive: { color: '#ffffff' },
  list: { gap: 10, paddingBottom: 20 },
  row: { backgroundColor: '#0f172a', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#1e293b', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemTitle: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  itemSub: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  priceTag: { color: '#818cf8', fontWeight: 'bold' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toggleBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  toggleOn: { backgroundColor: '#065f46' },
  toggleOff: { backgroundColor: '#7f1d1d' },
  toggleText: { color: '#ffffff', fontSize: 11, fontWeight: 'bold' },
  deleteBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center' },
  deleteText: { color: '#ef4444', fontSize: 12, fontWeight: 'bold' },
  emptyText: { color: '#64748b', textAlign: 'center', marginVertical: 30 },
  modalBg: { flex: 1, backgroundColor: '#00000095', justifyContent: 'center', padding: 20 },
  modalBox: { backgroundColor: '#0f172a', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#1e293b' },
  modalTitle: { color: '#ffffff', fontSize: 17, fontWeight: 'bold', marginBottom: 12 },
  input: { backgroundColor: '#020617', borderWidth: 1, borderColor: '#334155', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: '#ffffff', fontSize: 14, marginBottom: 10 },
  inputLabel: { color: '#cbd5e1', fontSize: 12, fontWeight: '600', marginBottom: 6 },
  catChoice: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#020617', marginRight: 6, borderWidth: 1, borderColor: '#334155' },
  catChoiceActive: { backgroundColor: '#4f46e5', borderColor: '#6366f1' },
  catChoiceText: { color: '#94a3b8', fontSize: 11 },
  catChoiceTextActive: { color: '#ffffff', fontWeight: 'bold' },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btnCancel: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 10 },
  btnCancelText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  btnConfirm: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: '#4f46e5', borderRadius: 10 },
  btnConfirmText: { color: '#ffffff', fontSize: 13, fontWeight: 'bold' },
});