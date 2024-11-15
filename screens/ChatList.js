import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Modal,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  orderBy,
  limit,
  Timestamp,
  writeBatch,
  deleteField,
  serverTimestamp,
  arrayUnion,
} from "firebase/firestore";
import { Ionicons, Feather } from "@expo/vector-icons";
import { auth, database } from "../config/firebase";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Menu, Provider } from "react-native-paper";
import Notes from "../Components/Notes/Notes";

const muteOptions = [
  { label: "1 hora", value: 1 },
  { label: "4 horas", value: 4 },
  { label: "8 horas", value: 8 },
  { label: "24 horas", value: 24 },
];

export default function ChatList() {
  const [chats, setChats] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [filteredChats, setFilteredChats] = useState([]);
  const [isNightMode, setIsNightMode] = useState(false);
  const [hiddenChats, setHiddenChats] = useState([]);
  const [showHiddenChats, setShowHiddenChats] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [selectedHiddenChat, setSelectedHiddenChat] = useState(null);
  const [password, setPassword] = useState("");
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [selectedChats, setSelectedChats] = useState([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showMuteOptions, setShowMuteOptions] = useState(false);
  const [selectAll, setSelectAll] = useState(false);

  const user = auth.currentUser;
  const navigation = useNavigation();
  const theme = isNightMode ? darkTheme : lightTheme;

  useEffect(() => {
    const checkTime = () => {
      const currentHour = new Date().getHours();
      setIsNightMode(currentHour >= 18 || currentHour < 6);
    };

    checkTime();
    const interval = setInterval(checkTime, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    navigation.setOptions({
      headerStyle: {
        backgroundColor: isNightMode ? '#1a1a1a' : '#fff',
      },
      headerTintColor: isNightMode ? '#fff' : '#000',
      headerLeft: () => (
        <Ionicons
          name="arrow-back"
          size={24}
          color={isNightMode ? '#fff' : '#000'}
          style={{ marginLeft: 10 }}
          onPress={() => navigation.goBack()}
        />
      ),
    });
  }, [navigation, isNightMode]);

  useFocusEffect(
    useCallback(() => {
      const fetchChats = async () => {
        if (!user) return;
  
        const chatsRef = collection(database, "chats");
        const q = query(
          chatsRef,
          where("participants", "array-contains", user.uid)
        );
  
        const unsubscribe = onSnapshot(q, async (querySnapshot) => {
          const chatList = await Promise.all(
            querySnapshot.docs.map(async (docSnapshot) => {
              const chatData = docSnapshot.data();
  
              // Verificar si el chat fue eliminado para el usuario actual
              if (chatData.deletedFor && chatData.deletedFor[user.uid]) {
                const deletedAt = chatData.deletedFor[user.uid].deletedAt;
                const lastMessageTimestamp =
                  chatData.lastMessageTimestamp?.toDate();
  
                // Si no hay mensaje nuevo después de la eliminación, no mostrar el chat
                if (
                  !lastMessageTimestamp ||
                  lastMessageTimestamp <= new Date(deletedAt)
                ) {
                  return null;
                }
              }
  
              // Obtener el ID del otro usuario
              const otherUserId = chatData.participants.find(
                (uid) => uid !== user.uid
              );
  
              // Obtener la información del otro usuario
              const otherUserDoc = await getDoc(
                doc(database, "users", otherUserId)
              );
              if (!otherUserDoc.exists()) {
                console.error(`User with ID ${otherUserId} not found`);
                return null;
              }
  
              const otherUserData = otherUserDoc.data();
  
              // Obtener el último mensaje de la conversación
              const messagesRef = collection(
                database,
                "chats",
                docSnapshot.id,
                "messages"
              );
              const lastMessageQuery = query(
                messagesRef,
                orderBy("createdAt", "desc"),
                limit(1)
              );
              const lastMessageSnapshot = await getDocs(lastMessageQuery);
              const lastMessage = lastMessageSnapshot.docs[0]?.data();
  
              // Calcular el número de mensajes no leídos
              let unreadCount = 0;
              if (lastMessage && lastMessage.senderId !== user.uid) {
                const unreadQuery = query(
                  messagesRef,
                  where("seen", "not-in", [user.uid]) // Filtra mensajes no vistos por el usuario
                );
                const unreadSnapshot = await getDocs(unreadQuery);
                unreadCount = unreadSnapshot.size;
              }
  
              // Devolver los datos del chat
              return {
                id: docSnapshot.id,
                user: { ...otherUserData, id: otherUserId },
                lastMessage,
                unreadCount: unreadCount,
              };
            })
          );
  
          // Filtrar valores nulos (chats eliminados) y ordenar los chats
          const sortedChats = chatList
            .filter((chat) => chat !== null)
            .sort(
              (a, b) =>
                b.lastMessage?.createdAt?.toMillis() -
                a.lastMessage?.createdAt?.toMillis()
            );
  
          setChats(sortedChats);
        });
  
        return () => unsubscribe();
      };
  
      fetchChats();
    }, [user?.uid])
  );
  

  useEffect(() => {
    const filtered = chats.filter((chat) =>
      chat.user.username.toLowerCase().includes(searchText.toLowerCase())
    );
    setFilteredChats(filtered);
  }, [chats, searchText]);

  const handleDeleteChat = async (chat) => {
    try {
      const batch = writeBatch(database);
      const chatRef = doc(database, "chats", chat.id);
      const messagesRef = collection(database, "chats", chat.id, "messages");

      // Get the current timestamp
      const currentTimestamp = serverTimestamp();

      // Update the deletedFor field for the chat
      batch.update(chatRef, {
        [`deletedFor.${user.uid}`]: {
          timestamp: currentTimestamp,
          deletedAt: new Date().toISOString(), // Store the client-side timestamp as well
        },
      });

      // Mark each message individually for the user
      const messagesSnapshot = await getDocs(messagesRef);
      messagesSnapshot.forEach((messageDoc) => {
        batch.update(messageDoc.ref, {
          [`deletedFor.${user.uid}`]: {
            timestamp: currentTimestamp,
            deletedAt: new Date().toISOString(),
          },
        });
      });

      await batch.commit();

      // Update the local state
      setChats((prevChats) => prevChats.filter((c) => c.id !== chat.id));

      Alert.alert("Éxito", "El chat ha sido eliminado para ti.");
    } catch (error) {
      console.error("Error al eliminar el chat:", error);
      Alert.alert(
        "Error",
        "No se pudo eliminar el chat. Por favor, intenta nuevamente."
      );
    }
  };

  const handleHideChat = (chat) => {
    if (Platform.OS === "ios") {
      Alert.prompt(
        "Ocultar chat",
        "Ingresa una contraseña para ocultar este chat",
        [
          {
            text: "Cancelar",
            style: "cancel",
          },
          {
            text: "Ocultar",
            onPress: (password) => hideChat(chat, password),
          },
        ],
        "secure-text"
      );
    } else {
      setSelectedHiddenChat(chat);
      setPasswordModalVisible(true);
    }
  };

  const hideChat = async (chat, password) => {
    if (password) {
      try {
        await updateDoc(doc(database, "chats", chat.id), {
          isHidden: true,
          password: password,
        });
        setChats(chats.filter((c) => c.id !== chat.id));
        setHiddenChats([...hiddenChats, { ...chat, isHidden: true, password }]);
      } catch (error) {
        console.error("Error al ocultar el chat:", error);
        Alert.alert("Error", "No se pudo ocultar el chat. Inténtalo de nuevo.");
      }
    } else {
      Alert.alert("Error", "Debes ingresar una contraseña");
    }
  };

  const handleHiddenChatPress = (chat) => {
    setSelectedHiddenChat(chat);
    setPasswordModalVisible(true);
  };

  const handlePasswordSubmit = () => {
    if (selectedHiddenChat && password === selectedHiddenChat.password) {
      updateDoc(doc(database, "chats", selectedHiddenChat.id), {
        isHidden: false,
        password: "",
      });
      setChats([...chats, { ...selectedHiddenChat, isHidden: false }]);
      setHiddenChats(hiddenChats.filter((c) => c.id !== selectedHiddenChat.id));
      setPasswordModalVisible(false);
      setPassword("");
      setSelectedHiddenChat(null);
    } else {
      Alert.alert("Error", "Contraseña incorrecta");
    }
  };

  const handleChatPress = async (chat) => {
    try {
      const chatRef = doc(database, "chats", chat.id);
      const messagesRef = collection(database, "chats", chat.id, "messages");
      const batch = writeBatch(database);
      const messagesSnapshot = await getDocs(messagesRef);
  
      messagesSnapshot.docs.forEach((doc) => {
        if (doc.data().senderId !== user.uid && !doc.data().seen.includes(user.uid)) {
          batch.update(doc.ref, { seen: arrayUnion(user.uid) });
        }
      });
  
      await batch.commit();
  
      // Actualizar la lista de chats local para reflejar los mensajes vistos
      setChats((prevChats) =>
        prevChats.map((c) =>
          c.id === chat.id ? { ...c, unreadCount: 0 } : c
        )
      );
  
      navigation.navigate("ChatUsers", {
        chatId: chat.id,
        recipientUser: chat.user,
        currentUserId: user.uid,
        recipientUserId: chat.user.id,
      });
    } catch (error) {
      console.error("Error updating message seen status:", error);
    }
  };
  
  const formatTime = (timestamp) => {
    if (!(timestamp instanceof Timestamp)) {
      console.error("Invalid timestamp:", timestamp);
      return "";
    }

    const now = new Date();
    const messageDate = timestamp.toDate();
    const diff = now.getTime() - messageDate.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const weeks = Math.floor(days / 7);

    if (days === 0) {
      return messageDate.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } else if (days === 1) {
      return "Ayer";
    } else if (days < 7) {
      return `${days} días`;
    } else if (weeks === 1) {
      return "1 sem";
    } else {
      return `${weeks} sem`;
    }
  };

  const truncateMessage = (message, maxLength = 20) => {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength) + "...";
  };

  const handleOptionsPress = () => {
    setShowOptionsMenu(!showOptionsMenu);
  };

  const handleSelectAll = () => {
    setSelectAll(!selectAll);
    if (!selectAll) {
      setSelectedChats(chats.map((chat) => chat.id));
    } else {
      setSelectedChats([]);
    }
  };

  const handleDeleteSelectedChats = async () => {
    try {
      const batch = writeBatch(database);

      for (const chatId of selectedChats) {
        const chatRef = doc(database, "chats", chatId);
        const messagesRef = collection(database, "chats", chatId, "messages");

        batch.update(chatRef, { [`deletedFor.${user.uid}`]: true });

        const messagesSnapshot = await getDocs(messagesRef);
        messagesSnapshot.forEach((messageDoc) => {
          batch.update(messageDoc.ref, { [`deletedFor.${user.uid}`]: true });
        });
      }

      await batch.commit();

      setChats((prevChats) =>
        prevChats.filter((chat) => !selectedChats.includes(chat.id))
      );
      setSelectedChats([]);

      Alert.alert("Success", "Selected chats have been deleted for you.");
    } catch (error) {
      console.error("Error deleting chats:", error);
      Alert.alert(
        "Error",
        "Failed to delete the selected chats. Please try again."
      );
    }
  };

  const handleMuteSelectedChats = (hours) => {
    selectedChats.forEach((chatId) => {
      const chatRef = doc(database, "chats", chatId);
      const muteUntil = new Date(Date.now() + hours * 60 * 60 * 1000);
      updateDoc(chatRef, { mutedUntil: muteUntil });
    });
    setSelectedChats([]);
    setIsSelectionMode(false);
    setShowMuteOptions(false);
  };

  const toggleChatSelection = (chatId) => {
    setSelectedChats((prevSelected) =>
      prevSelected.includes(chatId)
        ? prevSelected.filter((id) => id !== chatId)
        : [...prevSelected, chatId]
    );
  };

  const renderUnreadMessageCount = (chat) => {
    if (chat.unreadCount && chat.unreadCount > 0) {
      return (
        <View style={styles.unreadCountContainer}>
          <Text style={styles.unreadCountText}>{chat.unreadCount}</Text>
        </View>
      );
    }
    return null;
  };

  const renderChatItem = ({ item }) => (
    <TouchableOpacity
      
      style={[styles.chatItem, { backgroundColor: "transparent" }]}
      onPress={() =>
        isSelectionMode ? toggleChatSelection(item.id) : handleChatPress(item)
      }
      onLongPress={() => {
        Alert.alert(
          "Eliminar chat",
          "¿Estás seguro de que quieres eliminar este chat?",
          [
            {
              text: "Cancelar",
              style: "cancel",
            },
            {
              text: "Eliminar",
              onPress: () => handleDeleteChat(item),
            },
          ]
        );
      }}
    >
      {isSelectionMode && (
        <View
          style={[
            styles.checkbox,
            (selectedChats.includes(item.id) || selectAll) &&
              styles.checkboxSelected,
          ]}
        />
      )}
      <Image
        source={{
          uri: item.user.photoUrls?.[0] || "https://via.placeholder.com/150",
        }}
        style={styles.userImage}
        cachePolicy="memory-disk"
      />

      <View style={styles.chatInfo}>
        <View style={styles.chatHeader}>
          <Text
            style={[
              styles.chatTitle,
              { color: theme.text },
              item.unreadCount > 0 && styles.unseenChatTitle,
            ]}
          >
            {(item.user.firstName || "") + " " + (item.user.lastName || "") ||
              "Usuario desconocido"}
          </Text>
          <View style={styles.timeAndUnreadContainer}>
            {renderUnreadMessageCount(item)}
            {item.lastMessage && item.lastMessage.createdAt && (
              <Text
                style={[styles.lastMessageTime, { color: theme.textSecondary }]}
              >
                {formatTime(item.lastMessage.createdAt)}
              </Text>
            )}
          </View>
        </View>
        {item.lastMessage && item.lastMessage.senderId !== user.uid && (
          <Text
            style={[styles.lastMessagePreview, { color: theme.textSecondary }]}
            numberOfLines={1}
          >
            {truncateMessage(item.lastMessage.text || "Multimedia")}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <Provider>
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
      >
        <LinearGradient
          colors={isNightMode ? ["#1a1a1a", "#000"] : ["#fff", "#f0f0f0"]}
          style={styles.container}
        >
          <Notes />
          <View
            style={[styles.searchContainer, { borderColor: theme.borderColor }]}
          >
            <Ionicons
              name="search"
              size={20}
              color={theme.icon}
              style={styles.searchIcon}
            />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Pesquisar"
              placeholderTextColor={theme.placeholder}
              value={searchText}
              onChangeText={setSearchText}
            />
          </View>

          <View style={styles.titleContainer}>
            <Text style={[styles.title, { color: theme.text }]}>Mensajes</Text>
            <Menu
              visible={showOptionsMenu}
              onDismiss={() => setShowOptionsMenu(false)}
              anchor={
                <TouchableOpacity onPress={handleOptionsPress}>
                  <Ionicons
                    name="ellipsis-horizontal"
                    size={24}
                    color={theme.icon}
                    style={styles.dotsIcon}
                  />
                </TouchableOpacity>
              }
            >
              <Menu.Item
                onPress={() => {
                  setIsSelectionMode(true);
                  setShowOptionsMenu(false);
                }}
                title="Borrar Mensajes"
              />
              <Menu.Item
                onPress={() => {
                  setIsSelectionMode(true);
                  setShowMuteOptions(true);
                  setShowOptionsMenu(false);
                }}
                title="Silenciar Notificaciones"
              />
            </Menu>
          </View>

          {isSelectionMode && (
            <TouchableOpacity
              style={[styles.selectAllButton, { backgroundColor: theme.buttonBackground }]}
              onPress={handleSelectAll}
            >
              <Text style={[styles.selectAllText, { color: theme.buttonText }]}>
                {selectAll ? "Deseleccionar todos" : "Seleccionar todos"}
              </Text>
            </TouchableOpacity>
          )}

          {showMuteOptions && (
            <View style={[styles.muteOptionsContainer, { backgroundColor: theme.muteOptionsBackground }]}>
              {muteOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.muteOption, { backgroundColor: theme.muteOptionBackground }]}
                  onPress={() => handleMuteSelectedChats(option.value)}
                >
                  <Text style={[styles.muteOptionText, { color: theme.muteOptionText }]}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <FlatList
            data={showHiddenChats ? hiddenChats : filteredChats}
            keyExtractor={(item) => item.id}
            renderItem={renderChatItem}
          />

          {isSelectionMode && (
            <View style={[styles.selectionModeContainer, { backgroundColor: theme.selectionModeBackground }]}>
              <TouchableOpacity
                style={[styles.selectionModeButton, { backgroundColor: theme.selectionModeButtonBackground }]}
                onPress={handleDeleteSelectedChats}
              >
                <Text style={[styles.selectionModeButtonText, { color: theme.selectionModeButtonText }]}>Borrar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.selectionModeButton, { backgroundColor: theme.selectionModeButtonBackground }]}
                onPress={() => setShowMuteOptions(true)}
              >
                <Text style={[styles.selectionModeButtonText, { color: theme.selectionModeButtonText }]}>Silenciar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.selectionModeButton, { backgroundColor: theme.selectionModeButtonBackground }]}
                onPress={() => setIsSelectionMode(false)}
              >
                <Text style={[styles.selectionModeButtonText, { color: theme.selectionModeButtonText }]}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          )}

          <Modal
            visible={passwordModalVisible}
            transparent={true}
            animationType="slide"
          >
            <View style={styles.modalContainer}>
              <View
                style={[
                  styles.modalContent,
                  { backgroundColor: theme.modalBackground },
                ]}
              >
                <Text style={[styles.modalTitle, { color: theme.text }]}>
                  Ingresa la contraseña
                </Text>
                <TextInput
                  style={[
                    styles.passwordInput,
                    { color: theme.text, borderColor: theme.borderColor },
                  ]}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Contraseña"
                  placeholderTextColor={theme.placeholder}
                />
                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    { backgroundColor: theme.submitButtonBackground },
                  ]}
                  onPress={handlePasswordSubmit}
                >
                  <Text
                    style={[
                      styles.submitButtonText,
                      { color: theme.submitButtonText },
                    ]}
                  >
                    Enviar
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setPasswordModalVisible(false)}
                >
                  <Text
                    style={[
                      styles.cancelButtonText,
                      { color: theme.cancelButtonText },
                    ]}
                  >
                    Cancelar
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </LinearGradient>
      </SafeAreaView>
    </Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 20,
    marginHorizontal: 15,
    paddingHorizontal: 10,
    marginBottom: 15,
    height: 43,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 40,
  },
  titleContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 15,
    marginVertical: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 10,
    marginBottom: 10,
  },
  dotsIcon: {
    marginLeft: 10,
  },
  chatItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  userImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  chatInfo: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chatTitle: {
    fontSize: 16,
    fontWeight: "500",
  },
  unseenChatTitle: {
    fontWeight: "bold",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    padding: 20,
    borderRadius: 10,
    width: "80%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  passwordInput: {
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
  },
  submitButton: {
    padding: 10,
    borderRadius: 5,
    alignItems: "center",
    marginBottom: 10,
  },
  submitButtonText: {
    fontWeight: "bold",
  },
  cancelButton: {
    padding: 10,
    borderRadius: 5,
    alignItems: "center",
  },
  timeAndUnreadContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  unreadCountContainer: {
    backgroundColor: "black",
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 5,
  },
  unreadCountText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  lastMessageTime: {
    fontSize: 13,
  },
  lastMessagePreview: {
    fontSize: 14,
    marginTop: 2,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    marginRight: 10,
  },
  checkboxSelected: {
    backgroundColor: "#000",
  },
  selectionModeContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 10,
  },
  selectionModeButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    margin: 5,
  },
  selectionModeButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  muteOptionsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 10,
  },
  muteOption: {
    padding: 10,
    borderRadius: 5,
  },
  muteOptionText: {
    fontWeight: "bold",
  },
  selectAllButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    margin: 5,
    alignSelf: "center",
    width: "50%",
  },
  selectAllText: {
    textAlign: "center",
    fontSize: 16,
    fontWeight: "bold",
  },
});

const lightTheme = {
  background: "#fff",
  text: "#333",
  textSecondary: "#666",
  inputBackground: "#f5f5f5",
  placeholder: "#4b4b4b",
  icon: "#3e3d3d",
  borderColor: "#bbb7b7",
  noteBackground: "rgba(128, 128, 128, 0.7)",
  sendButtonBackground: "rgba(0, 0, 0, 0.5)",
  sendButtonIcon: "white",
  moodOptionsBackground: "rgba(255, 255, 255, 0.9)",
  noteResponseBackground: "white",
  modalBackground: "white",
  submitButtonBackground: "#b5a642",
  submitButtonText: "white",
  cancelButtonText: "#b5a642",
  buttonBackground: "rgba(255, 255, 255, 255)",
  buttonText: "#4b4b4b",
  muteOptionsBackground: "#f0f0f0",
  muteOptionBackground: "#3e3d3d",
  muteOptionText: "#fff",
  selectionModeBackground: "#f0f0f0",
  selectionModeButtonBackground: "rgba(255, 255, 255, 255)",
  selectionModeButtonText: "#4b4b4b",
};

const darkTheme = {
  background: "#000",
  text: "#fff",
  textSecondary: "#ccc",
  inputBackground: "#1a1a1a",
  placeholder: "white",
  icon: "#fff",
  borderColor: "#444",
  noteBackground: "rgba(64, 64, 64, 0.7)",
  sendButtonBackground: "rgba(255, 255, 255, 0.5)",
  sendButtonIcon: "black",
  moodOptionsBackground: "rgba(0, 0, 0, 0.9)",
  noteResponseBackground: "#1a1a1a",
  modalBackground: "#1a1a1a",
  submitButtonBackground: "black",
  submitButtonText: "black",
  cancelButtonText: "black",
  buttonBackground: "rgba(255, 255, 255, 0.2)",
  buttonText: "#fff",
  muteOptionsBackground: "#1a1a1a",
  muteOptionBackground: "black",
  muteOptionText: "#000",
  selectionModeBackground: "#1a1a1a",
  selectionModeButtonBackground: "rgba(255, 255, 255, 0.2)",
  selectionModeButtonText: "#fff",
};