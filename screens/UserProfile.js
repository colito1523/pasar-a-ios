import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Dimensions,
  Pressable,
} from "react-native";
import { Ionicons, AntDesign } from "@expo/vector-icons";
import { Menu, Divider, Provider } from "react-native-paper";
import { auth, database } from "../config/firebase";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  where,
  addDoc,
  deleteDoc,
  setDoc,
  Timestamp,
  updateDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  deleteField,
} from "firebase/firestore";
import FriendListModal from "../Components/Modals/FriendListModal";
import Complaints from "../Components/Complaints/Complaints";
import MutualFriendsModal from "../Components/Mutual-Friends-Modal/MutualFriendsModal";

import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';

const { width, height } = Dimensions.get("window");

const NameDisplay = ({ firstName, lastName }) => {
  const { t } = useTranslation();
  return (
    <View style={styles.nameContainer}>
      <Text style={styles.name}>
        {firstName} {lastName}
      </Text>
    </View>
  );
};

export default function UserProfile({ route, navigation }) {
  const { t } = useTranslation();
  const { selectedUser } = route.params || {};
  const [friendCount, setFriendCount] = useState(0);
  const [isNightMode, setIsNightMode] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [events, setEvents] = useState([]);
  const [friendshipStatus, setFriendshipStatus] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(false);
  const [photoUrls, setPhotoUrls] = useState([]);
  const [isFriendListVisible, setIsFriendListVisible] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [firstHobby, setFirstHobby] = useState("");
  const [secondHobby, setSecondHobby] = useState("");
  const [relationshipStatus, setRelationshipStatus] = useState("");
  const [firstInterest, setFirstInterest] = useState("");
  const [secondInterest, setSecondInterest] = useState("");
  const [mutualFriends, setMutualFriends] = useState([]);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0); // Added likeCount state
  const [isElementsVisible, setIsElementsVisible] = useState(true);
  const [hideStories, setHideStories] = useState(false);
  const [hideMyStories, setHideMyStories] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  const [heartCount, setHeartCount] = useState(0);
  const [isHearted, setIsHearted] = useState(false);
  const [isMutualFriendsModalVisible, setIsMutualFriendsModalVisible] = useState(false);

  const user = auth.currentUser;

  const openMenu = () => setMenuVisible(true);
  const closeMenu = () => setMenuVisible(false);

  const handleLongPress = () => {
    setIsElementsVisible(false);
  };

  const handlePressOut = () => {
    setIsElementsVisible(true);
  };

  const handleFriendSelect = (friend) => {
    navigation.navigate("UserProfile", { selectedUser: friend });
    setIsFriendListVisible(false);
  };
  const handleMutualFriendsPress = () => {
    setIsMutualFriendsModalVisible(true);
  };

  const handleReport = async () => {
    if (!selectedUser || !selectedUser.id) {
      Alert.alert(
        t('userProfile.error'),
        t('userProfile.cannotReportUser')
      );
      return;
    }

    try {
      const userDoc = await getDoc(doc(database, "users", selectedUser.id));

      if (userDoc.exists()) {
        setIsReportModalVisible(true);
        setMenuVisible(false);
      } else {
        Alert.alert(t('userProfile.error'), t('userProfile.userInfoError'));
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      Alert.alert(
        t('userProfile.error'),
        t('userProfile.userDataAccessError')
      );
    }
  };

  const handleHeartPress = () => {
    if (!isHearted) {
      setHeartCount(heartCount + 1);
      setIsHearted(true);
    } else {
      setHeartCount(heartCount - 1);
      setIsHearted(false);
    }
  };

  const handleReportSubmit = async (reason, description) => {
    try {
      const complaintsRef = collection(database, "complaints");
      const newComplaint = {
        reporterId: user.uid,
        reporterName: user.displayName || t('userProfile.anonymous'),
        reporterUsername: user.email ? user.email.split("@")[0] : "unknown",
        reportedId: selectedUser.id,
        reportedName: `${selectedUser.firstName} ${selectedUser.lastName}`,
        reportedUsername: selectedUser.username || "unknown",
        reason: reason,
        description: description,
        timestamp: Timestamp.now(),
      };
      await addDoc(complaintsRef, newComplaint);
      Alert.alert(
        t('userProfile.thankYou'),
        t('userProfile.reportSubmitted')
      );
    } catch (error) {
      console.error("Error submitting report:", error);
      Alert.alert(
        t('userProfile.error'),
        t('userProfile.reportSubmissionError')
      );
    }
    setIsReportModalVisible(false);
  };

  useEffect(() => {
    const checkHiddenStatus = async () => {
      if (user && selectedUser) {
        const userDoc = await getDoc(doc(database, "users", user.uid));
        const userData = userDoc.data();
        setHideStories(
          userData.hiddenStories?.includes(selectedUser.id) || false
        );
        setHideMyStories(
          userData.hideStoriesFrom?.includes(selectedUser.id) || false
        );
      }
    };
    checkHiddenStatus();
  }, [user, selectedUser]);

  const toggleHideStories = async () => {
    if (!user || !selectedUser) return;

    const userRef = doc(database, "users", user.uid);
    try {
      if (hideStories) {
        await updateDoc(userRef, {
          hiddenStories: arrayRemove(selectedUser.id),
        });
      } else {
        await updateDoc(userRef, {
          hiddenStories: arrayUnion(selectedUser.id),
        });
      }
      setHideStories(!hideStories);
      Alert.alert(
        t('userProfile.success'),
        hideStories
          ? t('userProfile.willSeeStories')
          : t('userProfile.willNotSeeStories')
      );
    } catch (error) {
      console.error("Error updating story visibility:", error);
      Alert.alert(t('userProfile.error'), t('userProfile.storySettingsUpdateError'));
    }
  };

  const toggleHideMyStories = async () => {
    if (!user || !selectedUser) return;

    const userRef = doc(database, "users", user.uid);
    const selectedUserRef = doc(database, "users", selectedUser.id);

    try {
      if (hideMyStories) {
        await updateDoc(userRef, {
          hideStoriesFrom: arrayRemove(selectedUser.id),
        });
        await updateDoc(selectedUserRef, {
          hiddenStories: arrayRemove(user.uid),
        });
      } else {
        await updateDoc(userRef, {
          hideStoriesFrom: arrayUnion(selectedUser.id),
        });
        await updateDoc(selectedUserRef, {
          hiddenStories: arrayUnion(user.uid),
        });
      }

      setHideMyStories(!hideMyStories);
      Alert.alert(
        t('userProfile.success'),
        hideMyStories
          ? t('userProfile.userCanSeeStories')
          : t('userProfile.userCannotSeeStories')
      );
    } catch (error) {
      console.error("Error updating my stories visibility:", error);
      Alert.alert(t('userProfile.error'), t('userProfile.myStorySettingsUpdateError'));
    }
  };

  const handleLikeProfile = async () => {
    if (!user || !selectedUser) return;

    const likesRef = collection(database, "users", selectedUser.id, "likes");
    const likeQuery = query(likesRef, where("userId", "==", user.uid));
    const likeSnapshot = await getDocs(likeQuery);

    if (likeSnapshot.empty) {
      try {
        const userDoc = await getDoc(doc(database, "users", user.uid));
        const userData = userDoc.data();
        const profileImage =
          userData.photoUrls && userData.photoUrls.length > 0
            ? userData.photoUrls[0]
            : "https://via.placeholder.com/150";

        // Add like to the selectedUser's likes collection
        await addDoc(likesRef, {
          userId: user.uid,
          username: userData.username,
          userImage: profileImage,
          timestamp: serverTimestamp(),
        });

        // Add like to the current user's Likes category
        const currentUserLikesRef = doc(database, "users", user.uid, "categories", "Likes");
        await setDoc(currentUserLikesRef, {
          [selectedUser.id]: {
            uid: selectedUser.id,
            image: selectedUser.photoUrls ? selectedUser.photoUrls[0] : "https://via.placeholder.com/150",
            timestamp: serverTimestamp(),
          }
        }, { merge: true });

        // Increment like count
        const newLikeCount = likeCount + 1;
        setLikeCount(newLikeCount);

        // Update like count in the user's document
        await updateDoc(doc(database, "users", selectedUser.id), {
          likeCount: newLikeCount
        });

        const notificationsRef = collection(
          database,
          "users",
          selectedUser.id,
          "notifications"
        );
        await addDoc(notificationsRef, {
          type: "like",
          fromId: user.uid,
          fromName: userData.username,
          fromImage: profileImage,
          message: t('userProfile.likedYourProfile', { username: userData.username }),
          timestamp: serverTimestamp(),
        });

        setIsLiked(true);
      } catch (error) {
        console.error("Error liking profile:", error);
        Alert.alert(t('userProfile.error'), t('userProfile.likeProfileError'));
      }
    } else {
      try {
        const likeDoc = likeSnapshot.docs[0];
        await deleteDoc(
          doc(database, "users", selectedUser.id, "likes", likeDoc.id)
        );

        // Remove like from the current user's Likes category
        const currentUserLikesRef = doc(database, "users", user.uid, "categories", "Likes");
        await setDoc(currentUserLikesRef, {
          [selectedUser.id]: deleteField()
        }, { merge: true });

        // Decrement like count
        const newLikeCount = Math.max(0, likeCount - 1);
        setLikeCount(newLikeCount);

        // Update like count in the user's document
        await updateDoc(doc(database, "users", selectedUser.id), {
          likeCount: newLikeCount
        });

        setIsLiked(false);
      } catch (error) {
        console.error("Error removing like from profile:", error);
        Alert.alert(t('userProfile.error'), t('userProfile.removeLikeError'));
      }
    }
  };

  useEffect(() => {
    const checkLikeStatus = async () => {
      if (user && selectedUser) {
        const likesRef = collection(
          database,
          "users",
          selectedUser.id,
          "likes"
        );
        const likeQuery = query(likesRef, where("userId", "==", user.uid));
        const likeSnapshot = await getDocs(likeQuery);
        setIsLiked(!likeSnapshot.empty);
      }
    };

    checkLikeStatus();
  }, [user, selectedUser]);

  useEffect(() => {
    const checkTime = () => {
      const currentHour = new Date().getHours();
      setIsNightMode(currentHour >= 19 || currentHour < 6);
    };

    checkTime();
    const interval = setInterval(checkTime, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  useEffect(() => {
    const fetchUserData = async () => {
      if (selectedUser && selectedUser.id) {
        const userDoc = await getDoc(doc(database, "users", selectedUser.id));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setIsPrivate(userData.isPrivate || false);

          // Check if the current user is a friend of the selected profile
          const friendsRef = collection(database, "users", user.uid, "friends");
          const q = query(friendsRef, where("friendId", "==", selectedUser.id));
          const friendSnapshot = await getDocs(q);
          const isFriend = !friendSnapshot.empty;

          // If the profile is private and the user is not a friend, redirect to PrivateUserProfile
          if (userData.isPrivate && !isFriend) {
            navigation.replace("PrivateUserProfile", { selectedUser });
            return;
          }

          if (userData.photoUrls && userData.photoUrls.length > 0) {
            setPhotoUrls(userData.photoUrls);
          } else {
            setPhotoUrls(["https://via.placeholder.com/400"]);
          }
          setFirstHobby(userData.firstHobby || "");
          setSecondHobby(userData.secondHobby || "");
          setRelationshipStatus(userData.relationshipStatus || "");
          setFirstInterest(userData.firstInterest || "");
          setSecondInterest(userData.secondInterest || "");
        }
      }
    };

    const fetchFriendCount = async () => {
      if (selectedUser && selectedUser.id) {
        const friendsRef = collection(
          database,
          "users",
          selectedUser.id,
          "friends"
        );
        const friendSnapshot = await getDocs(friendsRef);
        setFriendCount(friendSnapshot.size);
      }
    };

    const fetchEvents = async () => {
      if (selectedUser && selectedUser.id) {
        const eventsRef = collection(
          database,
          "users",
          selectedUser.id,
          "events"
        );
        const eventsSnapshot = await getDocs(eventsRef);
        const userEvents = eventsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        const filteredEvents = checkAndRemoveExpiredEvents(userEvents);
        setEvents(filteredEvents);
      }
    };

    const checkFriendship = async () => {
      if (user && selectedUser && selectedUser.id) {
        const friendsRef = collection(database, "users", user.uid, "friends");
        const q = query(friendsRef, where("friendId", "==", selectedUser.id));
        const friendSnapshot = await getDocs(q);
        setFriendshipStatus(!friendSnapshot.empty);

        const requestRef = collection(
          database,
          "users",
          selectedUser.id,
          "friendRequests"
        );
        const requestSnapshot = await getDocs(
          query(requestRef, where("fromId", "==", user.uid))
        );
        setPendingRequest(!requestSnapshot.empty);
      }
    };

    const fetchMutualFriends = async () => {
      if (user && selectedUser && selectedUser.id) {
        const userFriendsRef = collection(
          database,
          "users",
          user.uid,
          "friends"
        );
        
        const selectedUserFriendsRef = collection(
          database,
          "users",
          selectedUser.id,
          "friends"
        );

        const [userFriendsSnapshot, selectedUserFriendsSnapshot] =
          await Promise.all([
            getDocs(userFriendsRef),
            getDocs(selectedUserFriendsRef),
          ]);

        const userFriendIds = new Set(
          userFriendsSnapshot.docs.map((doc) => doc.data().friendId)
        );
        const mutualFriendIds = selectedUserFriendsSnapshot.docs
          .map((doc) => doc.data().friendId)
          .filter((id) => userFriendIds.has(id));

        const mutualFriendsData = await Promise.all(
          mutualFriendIds.map(async (id) => {
            const friendDoc = await getDoc(doc(database, "users", id));
            return friendDoc.data();
          })
        );

        setMutualFriends(mutualFriendsData);
      }
    };

    fetchUserData();
    fetchFriendCount();
    fetchEvents();
    checkFriendship();
    fetchMutualFriends();
  }, [selectedUser, user, friendshipStatus, navigation]);

  const checkAndRemoveExpiredEvents = (eventsList) => {
    const currentDate = new Date();
    const filteredEvents = eventsList.filter((event) => {
      const eventDate = parseEventDate(event.date);
      const timeDifference = currentDate - eventDate;
      const hoursPassed = timeDifference / (1000 * 60 * 60);

      if (hoursPassed >= 24) {
        // Remove the expired event from Firestore
        deleteDoc(doc(database, "users", selectedUser.id, "events", event.id))
          .then(() => console.log(`Event ${event.id} removed successfully`))
          .catch((error) => console.error(`Error removing event ${event.id}:`, error));
        return false;
      }
      return true;
    });

    return filteredEvents;
  };

  const parseEventDate = (dateString) => {
    const [day, month] = dateString.split(' ');
    const currentYear = new Date().getFullYear();
    const monthIndex = t('months', { returnObjects: true }).indexOf(month.toLowerCase());
    return new Date(currentYear, monthIndex, parseInt(day));
  };

  const blockUser = async (blockedUserId) => {
    const user = auth.currentUser;
    if (!user) return;

    const blockRef = collection(database, "users", user.uid, "blockedUsers");

    try {
      await addDoc(blockRef, {
        blockedId: blockedUserId,
        blockedAt: new Date(),
      });
      Alert.alert(t('userProfile.userBlocked'), t('userProfile.userBlockedMessage'));
    } catch (error) {
      console.error("Error blocking user:", error);
    }
  };

  const isUserBlocked = async () => {
    const blockedRef = collection(database, "users", user.uid, "blockedUsers");
    const blockedSnapshot = await getDocs(blockedRef);
    const blockedIds = blockedSnapshot.docs.map((doc) => doc.data().blockedId);

    return blockedIds.includes(selectedUser.id);
  };

  const handleSendMessage = async () => {
    const blocked = await isUserBlocked();
    if (blocked) {
      Alert.alert(
        t('userProfile.userBlocked'),
        t('userProfile.cannotSendMessage')
      );
      return;
    }
    const chatId = await getChatId(user.uid, selectedUser.id);
    const chatRef = doc(database, "chats", chatId);
    const chatDoc = await getDoc(chatRef);

    if (!chatDoc.exists()) {
      await setDoc(chatRef, {
        participants: [user.uid, selectedUser.id],
        createdAt: new Date(),
        lastMessage: "",
      });
    }

    navigation.navigate("ChatUsers", {
      chatId,
      recipientUser: selectedUser,
    });
  };

  const getChatId = async (user1Id, user2Id) => {
    const user1Doc = await getDoc(doc(database, "users", user1Id));
    const user2Doc = await getDoc(doc(database, "users", user2Id));

    const user1Name = user1Doc.data().username;
    const user2Name = user2Doc.data().username;

    return user1Name > user2Name
      ? `${user1Name}_${user2Name}`
      : `${user2Name}_${user1Name}`;
  };

  const renderMutualFriends = () => {
    if (mutualFriends.length === 0) {
      return (
        <View style={styles.mutualFriendsContainer}>
          <Text style={styles.noMutualFriendsText}>
            {t('userProfile.noMutualFriends')}
          </Text>
        </View>
      );
    }
  
    const containerWidth = mutualFriends.length * 40;
  
    return (
      <TouchableOpacity
        onPress={handleMutualFriendsPress}
        style={[
          styles.mutualFriendsContainer,
          { flexDirection: "row", alignItems: "center" },
        ]}
      >
        <View
          style={[
            styles.mutualFriendImagesContainer,
            { width: containerWidth },
          ]}
        >
          {mutualFriends.slice(0, 4).map((friend, index) => (
            <Image
              key={friend.id}
              source={{ uri: friend.photoUrls[0] }}
              style={[styles.mutualFriendImage, { left: index * 30 }]}
              cachePolicy="memory-disk"
            />
          ))}
        </View>
        <Text style={[styles.mutualFriendMoreText, { marginLeft: 10 }]}>
          {mutualFriends.length > 4
            ? t('userProfile.andMoreMutualFriends', { count: mutualFriends.length - 4 })
            : t('userProfile.mutualFriends')}
        </Text>
      </TouchableOpacity>
    );
  };
  

  const handleBoxPress = (box) => {
    const coordinates = box.coordinates || { latitude: 0, longitude: 0 };
    navigation.navigate("BoxDetails", {
      box: {
        title: box.title || t('userProfile.noTitle'),
        imageUrl: box.imageUrl || "https://via.placeholder.com/150",
        dateArray: box.dateArray || [],
        hours: box.hours || {},
        phoneNumber: box.phoneNumber || t('userProfile.noNumber'),
        locationLink: box.locationLink || t('userProfile.noLocation'),
        coordinates: coordinates,
      },
      selectedDate: box.date || t('userProfile.noDate'),
    });
  };

  const toggleUserStatus = async () => {
    if (!user || !selectedUser) return;

    const friendsRef = collection(database, "users", user.uid, "friends");
    const q = query(friendsRef, where("friendId", "==", selectedUser.id));
    const friendSnapshot = await getDocs(q);

    if (friendSnapshot.empty) {
      const requestRef = collection(
        database,
        "users",
        selectedUser.id,
        "friendRequests"
      );
      const existingRequestQuery = query(
        requestRef,
        where("fromId", "==", user.uid)
      );
      const existingRequestSnapshot = await getDocs(existingRequestQuery);

      const userDocRef = doc(database, "users", user.uid);
      const userDocSnapshot = await getDoc(userDocRef);

      const currentUser = userDocSnapshot.exists()
        ? userDocSnapshot.data()
        : {
            username: t('userProfile.anonymousUser'),
            profileImage: "https://via.placeholder.com/150",
          };

      const profileImage =
        currentUser.photoUrls && currentUser.photoUrls.length > 0
          ? currentUser.photoUrls[0]
          : "https://via.placeholder.com/150";

      if (existingRequestSnapshot.empty) {
        try {
          await addDoc(requestRef, {
            fromName: currentUser.username,
            fromId: user.uid,
            fromImage: profileImage,
            status: "pending",
            timestamp: Timestamp.now(),
          });

          setPendingRequest(true);
        } catch (error) {
          console.error("Error sending friend request:", error);
        }
      } else {
        try {
          existingRequestSnapshot.forEach(async (doc) => {
            await deleteDoc(doc.ref);
          });

          setPendingRequest(false);
        } catch (error) {
          console.error("Error canceling friend request:", error);
        }
      }
    } else {
      try {
        friendSnapshot.forEach(async (doc) => {
          await deleteDoc(doc.ref);
        });

        const reverseFriendSnapshot = await getDocs(
          query(
            collection(database, "users", selectedUser.id, "friends"),
            where("friendId", "==", user.uid)
          )
        );
        reverseFriendSnapshot.forEach(async (doc) => {
          await deleteDoc(doc.ref);
        });

        setFriendshipStatus(false);
        setFriendCount(friendCount - 1);
      } catch (error) {
        console.error("Error removing friendship:", error);
      }
    }
  };

  const renderOval = (value) => (
    <View style={styles.oval}>
      <Text style={styles.ovalText}>{value}</Text>
    </View>
  );

  const renderEvents = (start, end) => (
    <View style={styles.buttonContainer}>
      {events.slice(start, end).map((event, index) => (
        <TouchableOpacity
          key={index}
          style={styles.button}
          onPress={() => handleBoxPress(event)}
        >
          <Text style={styles.buttonText}>
            {event.title.length > 9
              ? event.title.substring(0, 5) + "..."
              : event.title}{" "}
            {event.date || t('userProfile.noTitle')}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  useEffect(() => {
    const fetchLikeCount = async () => {
      if (selectedUser && selectedUser.id) {
        const userDoc = await getDoc(doc(database, "users", selectedUser.id));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setLikeCount(userData.likeCount || 0);
        }
      }
    };

    fetchLikeCount();
  }, [selectedUser]); // Added useEffect to fetch like count

  return (
    <Provider>
      <ScrollView contentContainerStyle={styles.scrollViewContent}>
        <View style={styles.container}>
          {isElementsVisible && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              accessibilityLabel={t('userProfile.backButton')}
            >
              <Ionicons
                name="arrow-back"
                size={24}
                color={isNightMode ? "#fff" : "#000"}
              />
            </TouchableOpacity>
          )}
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollViewHorizontal}
            onScroll={(event) => {
              const contentOffset = event.nativeEvent.contentOffset;
              const viewSize = event.nativeEvent.layoutMeasurement;
              const pageNum = Math.floor(contentOffset.x / viewSize.width);
              setCurrentImageIndex(pageNum);
            }}
            scrollEventThrottle={16}
          >
            {photoUrls.map((url, index) => (
              <Pressable
                key={index}
                style={styles.imageContainer}
                onLongPress={handleLongPress}
                onPressOut={handlePressOut}
              >
                <Image
                  source={{ uri: url }}
                  style={styles.backgroundImage}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
                {isElementsVisible && (
                  <View style={styles.overlay}>
                    <NameDisplay
                      firstName={selectedUser.firstName}
                      lastName={selectedUser.lastName}
                    />
                    <View style={styles.infoContainer}>
                      {index === 0 && (
                        <>
                          <View style={styles.spacer} />
                          <TouchableOpacity
                            onPress={() => setIsFriendListVisible(true)}
                            style={styles.friendCountContainer}
                          >
                            <Text style={styles.number}>{friendCount}</Text>
                          </TouchableOpacity>
                          {renderEvents(0, 4)}
                        </>
                      )}
                      {index === 1 && (
                        <>
                          <View style={styles.spacer} />
                          <NameDisplay
                            firstName={selectedUser.firstName}
                            lastName={selectedUser.lastName}
                          />
                          <View style={styles.friendCountContainer}>
                            {renderMutualFriends()}
                          </View>
                          {renderEvents(4, 6)}
                        </>
                      )}
                      {index === 2 && (
                        <>
                          <View style={styles.contentWrapper}>
                            <View style={styles.ovalAndIconsContainer}>
                              <View style={styles.ovalWrapper}>
                                <View style={styles.ovalContainer}>
                                  {renderOval(firstHobby)}
                                  {renderOval(secondHobby)}
                                </View>
                               
                                <View style={styles.ovalContainer}>
                                  {renderOval(firstInterest)}
                                  {renderOval(secondInterest)}
                                </View>
                              </View>
                              <View style={styles.iconsContainer}>
                                <TouchableOpacity style={styles.iconButton} onPress={toggleUserStatus}>
                                  <AntDesign
                                    name={
                                      friendshipStatus
                                        ? "deleteuser"
                                        : pendingRequest
                                        ? "clockcircle"
                                        : "adduser"
                                    }
                                    size={24}
                                    color="white"
                                  />
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.iconButton} onPress={handleLikeProfile}>
                                  <AntDesign name={isLiked ? "heart" : "hearto"} size={24} color="white" />
                                  <Text style={styles.heartCountText}>{likeCount}</Text> 
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={styles.iconButton}
                                  onPress={handleSendMessage}
                                >
                                  <AntDesign
                                    name="message1"
                                    size={24}
                                    color="white"
                                  />
                                </TouchableOpacity>
                              </View>
                            </View>
                          </View>
                        </>
                      )}
                    </View>
                  </View>
                )}
              </Pressable>
            ))}
          </ScrollView>
          {isElementsVisible && (
            <View style={styles.menuContainer}>
              <Menu
                visible={menuVisible}
                onDismiss={closeMenu}
                anchor={
                  <TouchableOpacity
                    onPress={openMenu}
                    accessibilityLabel={t('userProfile.openOptionsMenu')}
                  >
                    <Ionicons
                      name="ellipsis-vertical"
                      size={24}
                      color="white"
                    />
                  </TouchableOpacity>
                }
                style={styles.menuStyle}
              >
                <Menu.Item
                  onPress={() => {
                    toggleUserStatus();
                    closeMenu();
                  }}
                  title={
                    friendshipStatus
                      ? t('userProfile.removeFriend')
                      : pendingRequest
                      ? t('userProfile.cancelRequest')
                      : t('userProfile.addFriend')
                  }
                />
                <Menu.Item
                  onPress={() => {
                    blockUser(selectedUser.id);
                    closeMenu();
                  }}
                  title={t('userProfile.block')}
                  titleStyle={{ color: "#FF3B30" }}
                />
                <Menu.Item onPress={handleReport} title={t('userProfile.report')} />
                <Menu.Item
                  onPress={toggleHideStories}
                  title={
                    hideStories ? t('userProfile.seeTheirStories') : t('userProfile.hideTheirStories')
                  }
                />
                <Menu.Item
                  onPress={toggleHideMyStories}
                  title={
                    hideMyStories
                      ? t('userProfile.showMyStories')
                      : t('userProfile.hideMyStories')
                  }
                />
                <Divider />
              </Menu>
            </View>
          )}
        </View>
      </ScrollView>
      <FriendListModal
        isVisible={isFriendListVisible}
        onClose={() => setIsFriendListVisible(false)}
        userId={selectedUser.id}
        onFriendSelect={handleFriendSelect}
      />
      <Complaints
        isVisible={isReportModalVisible}
        onClose={() => setIsReportModalVisible(false)}
        onSubmit={handleReportSubmit}
      />
      <MutualFriendsModal
  isVisible={isMutualFriendsModalVisible}
  onClose={() => setIsMutualFriendsModalVisible(false)}
  friends={mutualFriends}
/>
    </Provider>
  );
}
const styles = StyleSheet.create({
  scrollViewContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
  },
  backButton: {
    position: "absolute",
    top: 40,
    left: 20,
    zIndex: 10,
  },
  scrollViewHorizontal: {
    // This can be left empty as it's not needed for fixing the white space issue
  },
  imageContainer: {
    width: width,
    height: "100%",
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "flex-end",
    paddingBottom: 40,
  },
  infoContainer: {
    padding: 20,
  },
  nameContainer: {
    position: "absolute",
    top: 550,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  name: {
    fontSize: 25,
    fontWeight: "bold",
    color: "white",
  },
  spacer: {
    height: 150,
  },
  friendCountContainer: {
    alignItems: "flex-start",
    marginTop: 20,
    marginBottom: 20,
  
  },
  number: {
    fontSize: 24,
    color: "#fff",
    fontWeight: "bold",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    marginBottom: 5,
    gap: 10,
  },
  button: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingVertical: 5,
    paddingHorizontal: 20,
    borderRadius: 20,
    margin: 5,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  menuContainer: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
  },
  menuStyle: {
    borderRadius: 10,
  },
  ovalContainer: {
    marginTop: 20,
    marginBottom: 20,
    flexDirection: "row",
    justifyContent: "space-evenly",
    gap: 30,
  },
  oval: {
    width: "42%",
    height: 40,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  ovalText: {
    color: "white",
    fontSize: 14,
    fontWeight: "bold",
  },
  contentWrapper: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  ovalAndIconsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  ovalWrapper: {
    flex: 1,
  },
  iconsContainer: {
    flexDirection: "column",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginLeft: 10,
    gap: 20,
  },
  iconButton: {
    borderRadius: 20,
    padding: 10,
    marginBottom: 10,
  },
  mutualFriendIm: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: -15,
    borderWidth: 2,
    borderColor: "white",
  },
  mutualFriendsContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  mutualFriendImagesContainer: {
    flexDirection: "row",
    position: "relative",
    height: 40,
  },
  mutualFriendImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    position: "absolute",
  },
  mutualFriendMoreText: {
    color: "white",
    fontSize: 14,
    marginLeft: 10,
  },
  noMutualFriendsText: {
    color: "white",
    fontSize: 14,
  },
  heartCountText: {
    color: "white",
    fontSize: 16,
    marginTop: 5,
    textAlign: "center"
  }
});