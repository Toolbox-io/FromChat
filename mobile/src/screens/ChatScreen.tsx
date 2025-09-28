import React from 'react';
import { StyleSheet, SafeAreaView } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAppState } from '../state';
import ChatTab from '../components/chat/ChatTab';
import ChannelsTab from '../components/chat/ChannelsTab';
import ContactsTab from '../components/chat/ContactsTab';
import DMsTab from '../components/chat/DMsTab';

const Tab = createBottomTabNavigator();

export default function ChatScreen() {
    const { chat } = useAppState();

    return (
        <SafeAreaView style={styles.container}>
            <Tab.Navigator
                screenOptions={({ route }) => ({
                    tabBarIcon: ({ focused, color, size }) => {
                        let iconName: keyof typeof MaterialCommunityIcons.glyphMap;

                        switch (route.name) {
                            case 'Chats':
                                iconName = focused ? 'chat' : 'chat-outline';
                                break;
                            case 'Channels':
                                iconName = focused ? 'radio' : 'radio';
                                break;
                            case 'Contacts':
                                iconName = focused ? 'account-group' : 'account-group-outline';
                                break;
                            case 'DMs':
                                iconName = focused ? 'message' : 'message-outline';
                                break;
                            default:
                                iconName = 'chat-outline';
                        }

                        return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
                    },
                    tabBarActiveTintColor: '#1976d2',
                    tabBarInactiveTintColor: 'gray',
                    headerShown: false,
                })}
            >
                <Tab.Screen 
                    name="Chats" 
                    component={ChatTab}
                    options={{ title: 'Чаты' }}
                />
                <Tab.Screen 
                    name="Channels" 
                    component={ChannelsTab}
                    options={{ title: 'Каналы' }}
                />
                <Tab.Screen 
                    name="Contacts" 
                    component={ContactsTab}
                    options={{ title: 'Контакты' }}
                />
                <Tab.Screen 
                    name="DMs" 
                    component={DMsTab}
                    options={{ title: 'ЛС' }}
                />
            </Tab.Navigator>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
});